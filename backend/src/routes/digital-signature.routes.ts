import { FastifyInstance } from "fastify";
import { z } from "zod";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { prisma } from "../lib/prisma2";
import { requireRole } from "../plugins/auth";
import { generateAtestadoPdf, generateReceitaPdf, generateLaudoPdf, generateReceitaTextoPdf, generateSolicitacaoExamePdf } from "../lib/pdf-generator";
import { getSignatureProvider, defaultProvider, type ProviderName } from "../lib/signature/factory";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "signatures");

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const initSchema = z.object({
  documentType: z.enum(["ATESTADO", "RECEITA", "LAUDO", "RECEITA_TEXTO", "SOLICITACAO"]),
  referenceId: z.string(),
  provider: z.enum(["MOCK", "VIDAAS", "BIRDID"]).optional(),
});

export async function digitalSignatureRoutes(app: FastifyInstance) {
  ensureUploadsDir();
  const auth = requireRole('ADMIN', 'DOCTOR', 'RECEPTIONIST');

  // ─── Iniciar fluxo de assinatura ──────────────────────────────────────────
  app.post("/digital-signature/init", { preHandler: [auth] }, async (req, reply) => {
    const body = initSchema.parse(req.body);
    const providerName = (body.provider ?? defaultProvider()) as ProviderName;
    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";

    const { doctorId, patientId, pdfBuffer, metadata } = await buildDocument(body.documentType, body.referenceId);

    const documentHash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");
    const sigRec = await prisma.digitalSignature.create({
      data: {
        documentType: body.documentType,
        provider: providerName,
        status: "PENDING",
        doctorId,
        patientId,
        referenceId: body.referenceId,
        documentHash,
        metadata: metadata as object,
      },
    });

    // Salva PDF não-assinado em disco
    const pdfPath = path.join(UPLOADS_DIR, `${sigRec.id}_unsigned.pdf`);
    fs.writeFileSync(pdfPath, pdfBuffer);
    await prisma.digitalSignature.update({ where: { id: sigRec.id }, data: { pdfPath } });

    // Obtém URL de redirect para o provider OAuth
    const provider = getSignatureProvider(providerName);
    const doctor = await prisma.doctor.findUniqueOrThrow({
      where: { id: doctorId },
      include: { user: true },
    });
    const initResult = await provider.init({
      signatureId: sigRec.id,
      documentHash,
      doctorName: doctor.user.name,
      doctorCpf: doctor.cpf,
      frontendUrl,
    });

    if (initResult.codeVerifier) {
      await prisma.digitalSignature.update({
        where: { id: sigRec.id },
        data: { metadata: { ...(metadata as object), codeVerifier: initResult.codeVerifier } },
      });
    }

    return reply.status(201).send({ signatureId: sigRec.id, redirectUrl: initResult.redirectUrl });
  });

  // ─── Callback OAuth (Vidaas / BirDI) ──────────────────────────────────────
  app.get("/digital-signature/callback", async (req, reply) => {
    const query = req.query as Record<string, string>;
    const signatureId = query.state;
    if (!signatureId) return reply.status(400).send({ error: "state ausente" });

    await processSignature(signatureId, query, reply);
  });

  // ─── Mock: assina instantaneamente sem OAuth real ─────────────────────────
  app.get("/digital-signature/mock-sign/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { frontendUrl } = req.query as { frontendUrl?: string };
    await processSignature(id, {}, reply, frontendUrl);
  });

  // ─── Download PDF assinado ─────────────────────────────────────────────────
  app.get("/digital-signature/:id/download", { preHandler: [auth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const sig = await prisma.digitalSignature.findUnique({ where: { id } });
    if (!sig) return reply.status(404).send({ error: "Assinatura não encontrada" });
    if (sig.status !== "SIGNED" || !sig.signedPdfPath)
      return reply.status(400).send({ error: "Documento ainda não assinado" });

    if (!fs.existsSync(sig.signedPdfPath))
      return reply.status(404).send({ error: "Arquivo não encontrado no servidor" });

    const filename = `documento-assinado-${id}.pdf`;
    const fileBuffer = fs.readFileSync(sig.signedPdfPath);
    return reply
      .type("application/octet-stream")
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .header("Content-Length", fileBuffer.length)
      .send(fileBuffer);
  });

  // ─── Listar assinaturas ────────────────────────────────────────────────────
  app.get("/digital-signature", { preHandler: [auth] }, async (req, reply) => {
    const { patientId, doctorId, status } = req.query as Record<string, string>;
    const sigs = await prisma.digitalSignature.findMany({
      where: {
        ...(patientId ? { patientId } : {}),
        ...(doctorId ? { doctorId } : {}),
        ...(status ? { status: status as "PENDING" | "SIGNED" | "FAILED" } : {}),
      },
      include: {
        patient: { select: { id: true, fullName: true } },
        doctor: { select: { id: true, user: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    return reply.send(sigs);
  });

  // ─── Status de uma assinatura ──────────────────────────────────────────────
  app.get("/digital-signature/:id", { preHandler: [auth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const sig = await prisma.digitalSignature.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, fullName: true } },
        doctor: { select: { id: true, user: { select: { name: true } } } },
      },
    });
    if (!sig) return reply.status(404).send({ error: "Não encontrado" });
    return reply.send(sig);
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function buildDocument(documentType: string, referenceId: string) {
  const config = await prisma.config.findFirst();
  const clinic = {
    name: config?.clinicName ?? "Clínica",
    cnpj: config?.cnpj ?? "",
    cnes: config?.cnes ?? "",
    address: config?.address ?? "",
  };

  if (documentType === "ATESTADO") {
    const atestado = await prisma.atestado.findUniqueOrThrow({
      where: { id: referenceId },
      include: {
        patient: true,
        doctor: { include: { user: true } },
      },
    });
    const pdfBuffer = await generateAtestadoPdf({
      clinic,
      doctor: {
        name: atestado.doctor.user.name,
        crm: atestado.doctor.crm,
        crmState: atestado.doctor.crmState,
        specialty: atestado.doctor.specialty,
        cpf: atestado.doctor.cpf,
      },
      patient: {
        fullName: atestado.patient.fullName,
        cpf: atestado.patient.cpf,
        birthDate: atestado.patient.birthDate,
      },
      dias: atestado.dias,
      cid: atestado.cid,
      finalidade: atestado.finalidade,
      observacoes: atestado.observacoes,
      dataAtestado: atestado.dataAtestado,
    });
    return { doctorId: atestado.doctorId, patientId: atestado.patientId, pdfBuffer, metadata: { dias: atestado.dias, cid: atestado.cid } };
  }

  if (documentType === "RECEITA") {
    const rx = await prisma.prescription.findUniqueOrThrow({
      where: { id: referenceId },
      include: {
        patient: true,
        doctor: { include: { user: true } },
        items: { orderBy: { order: "asc" } },
      },
    });
    const pdfBuffer = await generateReceitaPdf({
      clinic,
      doctor: {
        name: rx.doctor.user.name,
        crm: rx.doctor.crm,
        crmState: rx.doctor.crmState,
        specialty: rx.doctor.specialty,
        cpf: rx.doctor.cpf,
      },
      patient: { fullName: rx.patient.fullName, cpf: rx.patient.cpf },
      items: rx.items,
      notes: rx.notes,
      emittedAt: rx.emittedAt,
      validUntil: rx.validUntil,
    });
    return { doctorId: rx.doctorId, patientId: rx.patientId, pdfBuffer, metadata: { items: rx.items.length } };
  }

  if (documentType === "LAUDO") {
    const order = await prisma.examOrder.findUniqueOrThrow({
      where: { id: referenceId },
      include: {
        patient: true,
        doctor: { include: { user: true } },
        catalog: true,
      },
    });
    if (!order.laudoContent) throw new Error("ExamOrder sem laudoContent para assinar");
    const pdfBuffer = await generateLaudoPdf({
      clinic,
      doctor: {
        name: order.doctor.user.name,
        crm: order.doctor.crm,
        crmState: order.doctor.crmState,
        specialty: order.doctor.specialty,
        cpf: order.doctor.cpf,
      },
      patient: { fullName: order.patient.fullName, cpf: order.patient.cpf },
      examName: order.catalog.name,
      content: order.laudoContent,
      completedAt: order.completedAt ?? new Date(),
    });
    return { doctorId: order.doctorId, patientId: order.patientId, pdfBuffer, metadata: { exam: order.catalog.name } };
  }

  if (documentType === "RECEITA_TEXTO") {
    const mr = await prisma.medicalRecord.findUniqueOrThrow({
      where: { id: referenceId },
      include: {
        patient: true,
        doctor: { include: { user: true } },
      },
    });
    const pdfBuffer = await generateReceitaTextoPdf({
      clinic,
      doctor: {
        name: mr.doctor.user.name,
        crm: mr.doctor.crm,
        crmState: mr.doctor.crmState,
        specialty: mr.doctor.specialty,
        cpf: mr.doctor.cpf,
      },
      patient: { fullName: mr.patient.fullName, cpf: mr.patient.cpf },
      prescriptionText: mr.prescription ?? "",
      emittedAt: mr.createdAt,
    });
    return { doctorId: mr.doctorId, patientId: mr.patientId, pdfBuffer, metadata: {} };
  }

  if (documentType === "SOLICITACAO") {
    const order = await prisma.examOrder.findUniqueOrThrow({
      where: { id: referenceId },
      include: {
        patient: true,
        doctor: { include: { user: true } },
        catalog: true,
      },
    });
    const pdfBuffer = await generateSolicitacaoExamePdf({
      clinic,
      doctor: {
        name: order.doctor.user.name,
        crm: order.doctor.crm,
        crmState: order.doctor.crmState,
        specialty: order.doctor.specialty,
        cpf: order.doctor.cpf,
      },
      patient: { fullName: order.patient.fullName, cpf: order.patient.cpf },
      examName: order.catalog.name,
      notes: order.notes,
      emittedAt: order.createdAt,
    });
    return { doctorId: order.doctorId, patientId: order.patientId, pdfBuffer, metadata: { exam: order.catalog.name } };
  }

  throw new Error(`Tipo de documento inválido: ${documentType}`);
}

async function processSignature(
  signatureId: string,
  callbackParams: Record<string, string>,
  reply: any,
  frontendUrl?: string
) {
  const sig = await prisma.digitalSignature.findUnique({ where: { id: signatureId } });
  if (!sig) return reply.status(404).send({ error: "Assinatura não encontrada" });
  if (sig.status === "SIGNED") {
    const fe = frontendUrl ?? process.env.FRONTEND_URL ?? "http://localhost:3000";
    return reply.redirect(`${fe}/assinaturas?id=${signatureId}&status=signed`);
  }

  try {
    if (!sig.pdfPath || !fs.existsSync(sig.pdfPath)) throw new Error("PDF original não encontrado");

    const pdfBuffer = fs.readFileSync(sig.pdfPath);
    const provider = getSignatureProvider(sig.provider as ProviderName);
    const meta = (sig.metadata as Record<string, string>) ?? {};
    const { signedBuffer, result } = await provider.sign(pdfBuffer, {
      oauthState: signatureId,
      ...callbackParams,
      codeVerifier: meta.codeVerifier,
    });

    const signedPdfPath = path.join(UPLOADS_DIR, `${signatureId}_signed.pdf`);
    fs.writeFileSync(signedPdfPath, signedBuffer);

    await prisma.digitalSignature.update({
      where: { id: signatureId },
      data: {
        status: "SIGNED",
        signedPdfPath,
        signerName: result.signerName,
        signerCpf: result.signerCpf,
        signedAt: result.signedAt,
      },
    });

    // Vincula a assinatura ao documento de origem
    await linkSignatureToDocument(sig.documentType, sig.referenceId, signatureId);

    const fe = frontendUrl ?? process.env.FRONTEND_URL ?? "http://localhost:3000";
    return reply.redirect(`${fe}/assinaturas?id=${signatureId}&status=signed`);
  } catch (err: any) {
    const errDetail = err?.response?.data ? JSON.stringify(err.response.data) : err.message;
    console.error(`[SIGNATURE ERROR] ${signatureId}:`, errDetail, err?.response?.status);
    await prisma.digitalSignature.update({ where: { id: signatureId }, data: { status: "FAILED" } });
    const fe = frontendUrl ?? process.env.FRONTEND_URL ?? "http://localhost:3000";
    return reply.redirect(`${fe}/assinaturas?id=${signatureId}&status=failed&error=${encodeURIComponent(errDetail)}`);
  }
}

async function linkSignatureToDocument(documentType: string, referenceId: string, signatureId: string) {
  if (documentType === "ATESTADO") {
    await prisma.atestado.update({ where: { id: referenceId }, data: { signatureId } });
  } else if (documentType === "RECEITA") {
    await prisma.prescription.update({ where: { id: referenceId }, data: { signatureId } });
  } else if (documentType === "LAUDO") {
    await prisma.examOrder.update({ where: { id: referenceId }, data: { signatureId } });
  }
}
