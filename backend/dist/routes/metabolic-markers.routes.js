"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metabolicMarkersRoutes = metabolicMarkersRoutes;
const zod_1 = require("zod");
const prisma2_1 = require("../lib/prisma2");
const auth_1 = require("../plugins/auth");
const requireAuth = (0, auth_1.requireRole)('ADMIN', 'DOCTOR', 'RECEPTIONIST');
const markerSchema = zod_1.z.object({
    patientId: zod_1.z.string(),
    date: zod_1.z.string(), // ISO date
    weight: zod_1.z.number().positive().optional(),
    bmi: zod_1.z.number().positive().optional(),
    systolicBP: zod_1.z.number().positive().optional(),
    diastolicBP: zod_1.z.number().positive().optional(),
    glucose: zod_1.z.number().positive().optional(),
    hba1c: zod_1.z.number().positive().optional(),
    totalChol: zod_1.z.number().positive().optional(),
    ldl: zod_1.z.number().positive().optional(),
    hdl: zod_1.z.number().positive().optional(),
    triglycerides: zod_1.z.number().positive().optional(),
    notes: zod_1.z.string().optional(),
});
async function metabolicMarkersRoutes(app) {
    // Listar marcadores de um paciente
    app.get('/metabolic-markers', { preHandler: [requireAuth] }, async (req, reply) => {
        const { patientId } = req.query;
        if (!patientId)
            return reply.status(400).send({ error: 'patientId obrigatório' });
        const markers = await prisma2_1.prisma.metabolicMarker.findMany({
            where: { patientId },
            orderBy: { date: 'asc' },
        });
        return reply.send(markers);
    });
    // Criar registro de marcadores
    app.post('/metabolic-markers', { preHandler: [requireAuth] }, async (req, reply) => {
        const data = markerSchema.parse(req.body);
        const marker = await prisma2_1.prisma.metabolicMarker.create({
            data: { ...data, date: new Date(data.date) },
        });
        return reply.status(201).send(marker);
    });
    // Atualizar
    app.patch('/metabolic-markers/:id', { preHandler: [requireAuth] }, async (req, reply) => {
        const { id } = req.params;
        const data = markerSchema.partial().omit({ patientId: true }).parse(req.body);
        const marker = await prisma2_1.prisma.metabolicMarker.update({
            where: { id },
            data: {
                ...data,
                ...(data.date ? { date: new Date(data.date) } : {}),
            },
        });
        return reply.send(marker);
    });
    // Deletar
    app.delete('/metabolic-markers/:id', { preHandler: [requireAuth] }, async (req, reply) => {
        const { id } = req.params;
        await prisma2_1.prisma.metabolicMarker.delete({ where: { id } });
        return reply.status(204).send();
    });
}
