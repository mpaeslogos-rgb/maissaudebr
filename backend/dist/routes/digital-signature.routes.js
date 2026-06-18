"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.digitalSignatureRoutes = digitalSignatureRoutes;
const zod_1 = require("zod");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const prisma2_1 = require("../lib/prisma2");
const auth_1 = require("../plugins/auth");
const pdf_generator_1 = require("../lib/pdf-generator");
const factory_1 = require("../lib/signature/factory");
const UPLOADS_DIR = path_1.default.join(process.cwd(), "uploads", "signatures");
function ensureUploadsDir() {
    if (!fs_1.default.existsSync(UPLOADS_DIR))
        fs_1.default.mkdirSync(UPLOADS_DIR, { recursive: true });
}
const initSchema = zod_1.z.object({
    documentType: zod_1.z.enum(["ATESTADO", "RECEITA", "LAUDO", "RECEITA_TEXTO", "SOLICITACAO"]),
    referenceId: zod_1.z.string(),
    provider: zod_1.z.enum(["MOCK", "VIDAAS", "BIRDID"]).optional(),
});
async function digitalSignatureRoutes(app) {
    ensureUploadsDir();
    const auth = (0, auth_1.requireRole)('ADMIN', 'DOCTOR', 'RECEPTIONIST');
    // ─── Iniciar fluxo de assinatura ──────────────────────────────────────────
    app.post("/digital-signature/init", { preHandler: [auth] }, async (req, reply) => {
        const body = initSchema.parse(req.body);
        const providerName = (body.provider ?? (0, factory_1.defaultProvider)());
        const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
        const { doctorId, patientId, pdfBuffer, metadata } = await buildDocument(body.documentType, body.referenceId);
        const documentHash = crypto_1.default.createHash("sha256").update(pdfBuffer).digest("hex");
        const sigRec = await prisma2_1.prisma.digitalSignature.create({
            data: {
                documentType: body.documentType,
                provider: providerName,
                status: "PENDING",
                doctorId,
                patientId,
                referenceId: body.referenceId,
                documentHash,
                metadata: metadata,
            },
        });
        // Salva PDF não-assinado em disco
        const pdfPath = path_1.default.join(UPLOADS_DIR, `${sigRec.id}_unsigned.pdf`);
        fs_1.default.writeFileSync(pdfPath, pdfBuffer);
        await prisma2_1.prisma.digitalSignature.update({ where: { id: sigRec.id }, data: { pdfPath } });
        // Obtém URL de redirect para o provider OAuth
        const provider = (0, factory_1.getSignatureProvider)(providerName);
        const doctor = await prisma2_1.prisma.doctor.findUniqueOrThrow({
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
            await prisma2_1.prisma.digitalSignature.update({
                where: { id: sigRec.id },
                data: { metadata: { ...metadata, codeVerifier: initResult.codeVerifier } },
            });
        }
        return reply.status(201).send({ signatureId: sigRec.id, redirectUrl: initResult.redirectUrl });
    });
    // ─── Callback OAuth (Vidaas / BirDI) ──────────────────────────────────────
    app.get("/digital-signature/callback", async (req, reply) => {
        const query = req.query;
        const signatureId = query.state;
        if (!signatureId)
            return reply.status(400).send({ error: "state ausente" });
        await processSignature(signatureId, query, reply);
    });
    // ─── Mock: assina instantaneamente sem OAuth real ─────────────────────────
    app.get("/digital-signature/mock-sign/:id", async (req, reply) => {
        const { id } = req.params;
        const { frontendUrl } = req.query;
        await processSignature(id, {}, reply, frontendUrl);
    });
    // ─── Download PDF assinado ─────────────────────────────────────────────────
    app.get("/digital-signature/:id/download", { preHandler: [auth] }, async (req, reply) => {
        const { id } = req.params;
        const sig = await prisma2_1.prisma.digitalSignature.findUnique({ where: { id } });
        if (!sig)
            return reply.status(404).send({ error: "Assinatura não encontrada" });
        if (sig.status !== "SIGNED" || !sig.signedPdfPath)
            return reply.status(400).send({ error: "Documento ainda não assinado" });
        if (!fs_1.default.existsSync(sig.signedPdfPath))
            return reply.status(404).send({ error: "Arquivo não encontrado no servidor" });
        const filename = `documento-assinado-${id}.pdf`;
        reply.header("Content-Disposition", `attachment; filename="${filename}"`);
        reply.header("Content-Type", "application/pdf");
        return reply.send(fs_1.default.createReadStream(sig.signedPdfPath));
    });
    // ─── Listar assinaturas ────────────────────────────────────────────────────
    app.get("/digital-signature", { preHandler: [auth] }, async (req, reply) => {
        const { patientId, doctorId, status } = req.query;
        const sigs = await prisma2_1.prisma.digitalSignature.findMany({
            where: {
                ...(patientId ? { patientId } : {}),
                ...(doctorId ? { doctorId } : {}),
                ...(status ? { status: status } : {}),
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
        const { id } = req.params;
        const sig = await prisma2_1.prisma.digitalSignature.findUnique({
            where: { id },
            include: {
                patient: { select: { id: true, fullName: true } },
                doctor: { select: { id: true, user: { select: { name: true } } } },
            },
        });
        if (!sig)
            return reply.status(404).send({ error: "Não encontrado" });
        return reply.send(sig);
    });
}
// ─── Helpers ─────────────────────────────────────────────────────────────────
async function buildDocument(documentType, referenceId) {
    const config = await prisma2_1.prisma.config.findFirst();
    const clinic = {
        name: config?.clinicName ?? "Clínica",
        cnpj: config?.cnpj ?? "",
        cnes: config?.cnes ?? "",
        address: config?.address ?? "",
    };
    if (documentType === "ATESTADO") {
        const atestado = await prisma2_1.prisma.atestado.findUniqueOrThrow({
            where: { id: referenceId },
            include: {
                patient: true,
                doctor: { include: { user: true } },
            },
        });
        const pdfBuffer = await (0, pdf_generator_1.generateAtestadoPdf)({
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
        const rx = await prisma2_1.prisma.prescription.findUniqueOrThrow({
            where: { id: referenceId },
            include: {
                patient: true,
                doctor: { include: { user: true } },
                items: { orderBy: { order: "asc" } },
            },
        });
        const pdfBuffer = await (0, pdf_generator_1.generateReceitaPdf)({
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
        const order = await prisma2_1.prisma.examOrder.findUniqueOrThrow({
            where: { id: referenceId },
            include: {
                patient: true,
                doctor: { include: { user: true } },
                catalog: true,
            },
        });
        if (!order.laudoContent)
            throw new Error("ExamOrder sem laudoContent para assinar");
        const pdfBuffer = await (0, pdf_generator_1.generateLaudoPdf)({
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
        const mr = await prisma2_1.prisma.medicalRecord.findUniqueOrThrow({
            where: { id: referenceId },
            include: {
                patient: true,
                doctor: { include: { user: true } },
            },
        });
        const pdfBuffer = await (0, pdf_generator_1.generateReceitaTextoPdf)({
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
        const order = await prisma2_1.prisma.examOrder.findUniqueOrThrow({
            where: { id: referenceId },
            include: {
                patient: true,
                doctor: { include: { user: true } },
                catalog: true,
            },
        });
        const pdfBuffer = await (0, pdf_generator_1.generateSolicitacaoExamePdf)({
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
async function processSignature(signatureId, callbackParams, reply, frontendUrl) {
    const sig = await prisma2_1.prisma.digitalSignature.findUnique({ where: { id: signatureId } });
    if (!sig)
        return reply.status(404).send({ error: "Assinatura não encontrada" });
    if (sig.status === "SIGNED") {
        const fe = frontendUrl ?? process.env.FRONTEND_URL ?? "http://localhost:3000";
        return reply.redirect(`${fe}/assinaturas?id=${signatureId}&status=signed`);
    }
    try {
        if (!sig.pdfPath || !fs_1.default.existsSync(sig.pdfPath))
            throw new Error("PDF original não encontrado");
        const pdfBuffer = fs_1.default.readFileSync(sig.pdfPath);
        const provider = (0, factory_1.getSignatureProvider)(sig.provider);
        const meta = sig.metadata ?? {};
        const { signedBuffer, result } = await provider.sign(pdfBuffer, {
            oauthState: signatureId,
            ...callbackParams,
            codeVerifier: meta.codeVerifier,
        });
        const signedPdfPath = path_1.default.join(UPLOADS_DIR, `${signatureId}_signed.pdf`);
        fs_1.default.writeFileSync(signedPdfPath, signedBuffer);
        await prisma2_1.prisma.digitalSignature.update({
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
    }
    catch (err) {
        await prisma2_1.prisma.digitalSignature.update({ where: { id: signatureId }, data: { status: "FAILED" } });
        const fe = frontendUrl ?? process.env.FRONTEND_URL ?? "http://localhost:3000";
        return reply.redirect(`${fe}/assinaturas?id=${signatureId}&status=failed&error=${encodeURIComponent(err.message)}`);
    }
}
async function linkSignatureToDocument(documentType, referenceId, signatureId) {
    if (documentType === "ATESTADO") {
        await prisma2_1.prisma.atestado.update({ where: { id: referenceId }, data: { signatureId } });
    }
    else if (documentType === "RECEITA") {
        await prisma2_1.prisma.prescription.update({ where: { id: referenceId }, data: { signatureId } });
    }
    else if (documentType === "LAUDO") {
        await prisma2_1.prisma.examOrder.update({ where: { id: referenceId }, data: { signatureId } });
    }
}
