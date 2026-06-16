"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkInsRoutes = checkInsRoutes;
const zod_1 = require("zod");
const prisma2_1 = require("../lib/prisma2");
const auth_1 = require("../plugins/auth");
const requireAuth = (0, auth_1.requireRole)('ADMIN', 'DOCTOR', 'RECEPTIONIST');
const checkInSchema = zod_1.z.object({
    patientId: zod_1.z.string(),
    enrollmentId: zod_1.z.string(),
    scheduledAt: zod_1.z.string(),
    type: zod_1.z.enum(['INITIAL_ASSESSMENT', 'MONTHLY_REVIEW', 'METABOLIC_REVIEW', 'LAB_RESULTS', 'FOLLOWUP']).optional(),
    notes: zod_1.z.string().optional(),
});
async function checkInsRoutes(app) {
    // Listar check-ins (filtrar por enrollmentId ou patientId)
    app.get('/check-ins', { preHandler: [requireAuth] }, async (req, reply) => {
        const { enrollmentId, patientId, pending } = req.query;
        const checkIns = await prisma2_1.prisma.checkIn.findMany({
            where: {
                ...(enrollmentId ? { enrollmentId } : {}),
                ...(patientId ? { patientId } : {}),
                ...(pending === 'true' ? { completedAt: null } : {}),
            },
            include: {
                patient: { select: { id: true, fullName: true } },
                enrollment: { include: { program: { select: { id: true, name: true } } } },
            },
            orderBy: { scheduledAt: 'asc' },
        });
        return reply.send(checkIns);
    });
    // Criar check-in
    app.post('/check-ins', { preHandler: [requireAuth] }, async (req, reply) => {
        const body = checkInSchema.parse(req.body);
        const checkIn = await prisma2_1.prisma.checkIn.create({
            data: {
                patientId: body.patientId,
                enrollmentId: body.enrollmentId,
                scheduledAt: new Date(body.scheduledAt),
                type: body.type ?? 'MONTHLY_REVIEW',
                notes: body.notes,
            },
            include: {
                patient: { select: { id: true, fullName: true } },
                enrollment: { include: { program: { select: { id: true, name: true } } } },
            },
        });
        return reply.status(201).send(checkIn);
    });
    // Completar ou editar check-in
    app.patch('/check-ins/:id', { preHandler: [requireAuth] }, async (req, reply) => {
        const { id } = req.params;
        const data = zod_1.z.object({
            completedAt: zod_1.z.string().nullable().optional(),
            notes: zod_1.z.string().optional(),
            scheduledAt: zod_1.z.string().optional(),
            type: zod_1.z.enum(['INITIAL_ASSESSMENT', 'MONTHLY_REVIEW', 'METABOLIC_REVIEW', 'LAB_RESULTS', 'FOLLOWUP']).optional(),
        }).parse(req.body);
        const updated = await prisma2_1.prisma.checkIn.update({
            where: { id },
            data: {
                ...(data.completedAt !== undefined ? { completedAt: data.completedAt ? new Date(data.completedAt) : null } : {}),
                ...(data.notes !== undefined ? { notes: data.notes } : {}),
                ...(data.scheduledAt !== undefined ? { scheduledAt: new Date(data.scheduledAt) } : {}),
                ...(data.type !== undefined ? { type: data.type } : {}),
            },
        });
        return reply.send(updated);
    });
    // Deletar check-in
    app.delete('/check-ins/:id', { preHandler: [requireAuth] }, async (req, reply) => {
        const { id } = req.params;
        await prisma2_1.prisma.checkIn.delete({ where: { id } });
        return reply.status(204).send();
    });
    // KPI: adesão aos check-ins de uma matrícula
    app.get('/check-ins/adhesion/:enrollmentId', { preHandler: [requireAuth] }, async (req, reply) => {
        const { enrollmentId } = req.params;
        const all = await prisma2_1.prisma.checkIn.count({ where: { enrollmentId } });
        const completed = await prisma2_1.prisma.checkIn.count({ where: { enrollmentId, completedAt: { not: null } } });
        const pending = all - completed;
        const adhesion = all > 0 ? Math.round((completed / all) * 100) : null;
        return reply.send({ total: all, completed, pending, adhesionPct: adhesion });
    });
}
