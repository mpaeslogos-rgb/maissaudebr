"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.atestadosRoutes = atestadosRoutes;
const zod_1 = require("zod");
const prisma2_1 = require("../lib/prisma2");
const auth_1 = require("../plugins/auth");
const createSchema = zod_1.z.object({
    patientId: zod_1.z.string(),
    doctorId: zod_1.z.string(),
    appointmentId: zod_1.z.string().optional(),
    dias: zod_1.z.number().int().positive(),
    cid: zod_1.z.string().optional(),
    finalidade: zod_1.z.enum(["trabalho", "escola", "outro"]),
    observacoes: zod_1.z.string().optional(),
    dataAtestado: zod_1.z.string().optional(),
});
async function atestadosRoutes(app) {
    const auth = (0, auth_1.requireRole)('ADMIN', 'DOCTOR', 'RECEPTIONIST');
    // Listar atestados (filtros: patientId, doctorId)
    app.get("/atestados", { preHandler: [auth] }, async (req, reply) => {
        const { patientId, doctorId } = req.query;
        const atestados = await prisma2_1.prisma.atestado.findMany({
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
        const { id } = req.params;
        const atestado = await prisma2_1.prisma.atestado.findUnique({
            where: { id },
            include: {
                patient: { select: { id: true, fullName: true, cpf: true, birthDate: true } },
                doctor: { select: { id: true, user: { select: { name: true } }, crm: true, crmState: true, specialty: true, cpf: true } },
                signature: true,
            },
        });
        if (!atestado)
            return reply.status(404).send({ error: "Atestado não encontrado" });
        return reply.send(atestado);
    });
    // Criar atestado
    app.post("/atestados", { preHandler: [auth] }, async (req, reply) => {
        const body = createSchema.parse(req.body);
        const atestado = await prisma2_1.prisma.atestado.create({
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
        const { id } = req.params;
        const atestado = await prisma2_1.prisma.atestado.findUnique({ where: { id } });
        if (!atestado)
            return reply.status(404).send({ error: "Não encontrado" });
        if (atestado.signatureId)
            return reply.status(400).send({ error: "Atestado assinado não pode ser excluído" });
        await prisma2_1.prisma.atestado.delete({ where: { id } });
        return reply.send({ ok: true });
    });
}
