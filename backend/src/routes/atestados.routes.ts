import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma2";
import { requireRole } from "../plugins/auth";

const createSchema = z.object({
  patientId: z.string(),
  doctorId: z.string(),
  appointmentId: z.string().optional(),
  dias: z.number().int().positive(),
  cid: z.string().optional(),
  finalidade: z.enum(["trabalho", "escola", "outro"]),
  observacoes: z.string().optional(),
  dataAtestado: z.string().optional(),
});

export async function atestadosRoutes(app: FastifyInstance) {
  const auth = requireRole('ADMIN', 'DOCTOR', 'RECEPTIONIST');

  // Listar atestados (filtros: patientId, doctorId)
  app.get("/atestados", { preHandler: [auth] }, async (req, reply) => {
    const { patientId, doctorId } = req.query as Record<string, string>;
    const atestados = await prisma.atestado.findMany({
      where: {
        ...(patientId ? { patientId } : {}),
        ...(doctorId ? { doctorId } : {}),
      },
      include: {
        patient: { select: { id: true, fullName: true, cpf: true } },
        doctor: { select: { id: true, user: { select: { name: true } }, crm: true, crmState: true, specialty: true } },
        signature: { select: { id: true, status: true, provider: true, signedAt: true, signerName: true, signedPdfPath: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return reply.send(atestados);
  });

  // Buscar atestado por ID
  app.get("/atestados/:id", { preHandler: [auth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const atestado = await prisma.atestado.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, fullName: true, cpf: true, birthDate: true } },
        doctor: { select: { id: true, user: { select: { name: true } }, crm: true, crmState: true, specialty: true, cpf: true } },
        signature: true,
      },
    });
    if (!atestado) return reply.status(404).send({ error: "Atestado não encontrado" });
    return reply.send(atestado);
  });

  // Criar atestado
  app.post("/atestados", { preHandler: [auth] }, async (req, reply) => {
    const body = createSchema.parse(req.body);
    const atestado = await prisma.atestado.create({
      data: {
        patientId: body.patientId,
        doctorId: body.doctorId,
        appointmentId: body.appointmentId,
        dias: body.dias,
        cid: body.cid,
        finalidade: body.finalidade,
        observacoes: body.observacoes,
        dataAtestado: body.dataAtestado ? new Date(body.dataAtestado) : new Date(),
      },
      include: {
        patient: { select: { id: true, fullName: true, cpf: true } },
        doctor: { select: { id: true, user: { select: { name: true } }, crm: true, crmState: true, specialty: true } },
      },
    });
    return reply.status(201).send(atestado);
  });

  // Deletar atestado (somente se não assinado)
  app.delete("/atestados/:id", { preHandler: [auth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const atestado = await prisma.atestado.findUnique({ where: { id } });
    if (!atestado) return reply.status(404).send({ error: "Não encontrado" });
    if (atestado.signatureId) return reply.status(400).send({ error: "Atestado assinado não pode ser excluído" });
    await prisma.atestado.delete({ where: { id } });
    return reply.send({ ok: true });
  });
}
