"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.patientEnrollmentsRoutes = patientEnrollmentsRoutes;
const zod_1 = require("zod");
const prisma2_1 = require("../lib/prisma2");
const auth_1 = require("../plugins/auth");
const requireAuth = (0, auth_1.requireRole)('ADMIN', 'DOCTOR', 'RECEPTIONIST');
const enrollSchema = zod_1.z.object({
    patientId: zod_1.z.string(),
    programId: zod_1.z.string(),
    startDate: zod_1.z.string(), // ISO date
    monthlyFee: zod_1.z.number().nonnegative().optional(),
    notes: zod_1.z.string().optional(),
});
async function patientEnrollmentsRoutes(app) {
    // Listar matrículas (opcionalmente filtrar por paciente ou status)
    app.get('/patient-enrollments', { preHandler: [requireAuth] }, async (req, reply) => {
        const { patientId, status } = req.query;
        const enrollments = await prisma2_1.prisma.patientEnrollment.findMany({
            where: {
                ...(patientId ? { patientId } : {}),
                ...(status ? { status: status } : {}),
            },
            include: {
                patient: { select: { id: true, fullName: true, phone: true } },
                program: { select: { id: true, name: true, durationDays: true } },
                _count: { select: { payments: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        return reply.send(enrollments);
    });
    // Matricular paciente em um programa
    app.post('/patient-enrollments', { preHandler: [requireAuth] }, async (req, reply) => {
        const body = enrollSchema.parse(req.body);
        const program = await prisma2_1.prisma.preventivoProgram.findUnique({ where: { id: body.programId } });
        if (!program)
            return reply.status(404).send({ error: 'Programa não encontrado' });
        const startDate = new Date(body.startDate);
        const monthlyFee = body.monthlyFee ?? program.monthlyFee;
        // Data de término = start + durationDays
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + program.durationDays);
        // Próxima cobrança = 1 mês após o início
        const nextBillingDate = new Date(startDate);
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        const enrollment = await prisma2_1.prisma.$transaction(async (tx) => {
            const enroll = await tx.patientEnrollment.create({
                data: {
                    patientId: body.patientId,
                    programId: body.programId,
                    startDate,
                    endDate,
                    monthlyFee,
                    nextBillingDate,
                    notes: body.notes,
                },
            });
            // Cria a primeira cobrança (taxa de entrada se houver + 1ª mensalidade)
            const totalFirstPayment = program.entryFee > 0
                ? program.entryFee + monthlyFee
                : monthlyFee;
            await tx.payment.create({
                data: {
                    patientId: body.patientId,
                    enrollmentId: enroll.id,
                    amount: totalFirstPayment,
                    dueDate: startDate,
                    description: program.entryFee > 0
                        ? `${program.name} — Entrada + 1ª mensalidade`
                        : `${program.name} — 1ª mensalidade`,
                },
            });
            return enroll;
        });
        const full = await prisma2_1.prisma.patientEnrollment.findUnique({
            where: { id: enrollment.id },
            include: {
                patient: { select: { id: true, fullName: true, phone: true } },
                program: true,
            },
        });
        return reply.status(201).send(full);
    });
    // Gerar próxima cobrança mensal manualmente
    app.post('/patient-enrollments/:id/bill', { preHandler: [requireAuth] }, async (req, reply) => {
        const { id } = req.params;
        const enrollment = await prisma2_1.prisma.patientEnrollment.findUnique({
            where: { id },
            include: { program: true },
        });
        if (!enrollment)
            return reply.status(404).send({ error: 'Matrícula não encontrada' });
        if (enrollment.status !== 'ACTIVE')
            return reply.status(400).send({ error: 'Matrícula não está ativa' });
        const dueDate = new Date(enrollment.nextBillingDate);
        const nextBillingDate = new Date(dueDate);
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        const [payment] = await prisma2_1.prisma.$transaction([
            prisma2_1.prisma.payment.create({
                data: {
                    patientId: enrollment.patientId,
                    enrollmentId: enrollment.id,
                    amount: enrollment.monthlyFee,
                    dueDate,
                    description: `${enrollment.program.name} — mensalidade`,
                },
            }),
            prisma2_1.prisma.patientEnrollment.update({
                where: { id },
                data: { nextBillingDate },
            }),
        ]);
        return reply.status(201).send(payment);
    });
    // Atualizar status / notas
    app.patch('/patient-enrollments/:id', { preHandler: [requireAuth] }, async (req, reply) => {
        const { id } = req.params;
        const data = zod_1.z.object({
            status: zod_1.z.enum(['ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED']).optional(),
            notes: zod_1.z.string().optional(),
            nextBillingDate: zod_1.z.string().optional(),
        }).parse(req.body);
        const updated = await prisma2_1.prisma.patientEnrollment.update({
            where: { id },
            data: {
                ...data,
                ...(data.nextBillingDate ? { nextBillingDate: new Date(data.nextBillingDate) } : {}),
            },
        });
        return reply.send(updated);
    });
}
