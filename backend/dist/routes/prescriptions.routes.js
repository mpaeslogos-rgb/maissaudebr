"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prescriptionsRoutes = prescriptionsRoutes;
const zod_1 = require("zod");
const prisma2_1 = require("../lib/prisma2");
const auth_1 = require("../plugins/auth");
const audit_1 = require("../lib/audit");
const itemSchema = zod_1.z.object({
    medication: zod_1.z.string().min(1, 'Medicamento obrigatório'),
    dosage: zod_1.z.string().min(1, 'Dose obrigatória'),
    frequency: zod_1.z.string().min(1, 'Frequência obrigatória'),
    duration: zod_1.z.string().optional(),
    instructions: zod_1.z.string().optional(),
    order: zod_1.z.number().int().default(0),
});
const createSchema = zod_1.z.object({
    doctorId: zod_1.z.string().min(1, 'Médico obrigatório'),
    appointmentId: zod_1.z.string().optional(),
    validUntil: zod_1.z.string().optional().transform(v => (v ? new Date(v) : undefined)),
    notes: zod_1.z.string().optional(),
    items: zod_1.z.array(itemSchema).min(1, 'Adicione pelo menos um medicamento'),
});
const doctorInclude = {
    include: { user: { select: { name: true } } },
};
async function prescriptionsRoutes(app) {
    app.addHook('onRequest', (0, auth_1.requireRole)('ADMIN', 'DOCTOR', 'RECEPTIONIST'));
    // LIST by patient
    app.get('/patients/:patientId/prescriptions', async (request) => {
        const { patientId } = request.params;
        const data = await prisma2_1.prisma.prescription.findMany({
            where: { patientId },
            orderBy: { emittedAt: 'desc' },
            include: { items: { orderBy: { order: 'asc' } }, doctor: doctorInclude },
        });
        return { data };
    });
    // GET single
    app.get('/patients/:patientId/prescriptions/:id', async (request, reply) => {
        const { patientId, id } = request.params;
        const p = await prisma2_1.prisma.prescription.findFirst({
            where: { id, patientId },
            include: { items: { orderBy: { order: 'asc' } }, doctor: doctorInclude },
        });
        if (!p)
            return reply.code(404).send({ error: 'Prescrição não encontrada' });
        return p;
    });
    // CREATE
    app.post('/patients/:patientId/prescriptions', async (request, reply) => {
        const { patientId } = request.params;
        const parsed = createSchema.safeParse(request.body);
        if (!parsed.success)
            return reply.code(400).send({ error: parsed.error.flatten() });
        const { items, ...rest } = parsed.data;
        const prescription = await prisma2_1.prisma.prescription.create({
            data: {
                ...rest,
                patientId,
                items: {
                    create: items.map((item, idx) => ({ ...item, order: item.order ?? idx })),
                },
            },
            include: { items: { orderBy: { order: 'asc' } }, doctor: doctorInclude },
        });
        const uid = request.user?.sub ?? null;
        (0, audit_1.logAudit)({ userId: uid, action: 'CREATE', entity: 'Prescription', entityId: prescription.id, request });
        return reply.code(201).send(prescription);
    });
    // DELETE
    app.delete('/patients/:patientId/prescriptions/:id', async (request, reply) => {
        const { patientId, id } = request.params;
        const existing = await prisma2_1.prisma.prescription.findFirst({ where: { id, patientId }, select: { id: true } });
        if (!existing)
            return reply.code(404).send({ error: 'Prescrição não encontrada' });
        await prisma2_1.prisma.prescription.delete({ where: { id } });
        const uid = request.user?.sub ?? null;
        (0, audit_1.logAudit)({ userId: uid, action: 'DELETE', entity: 'Prescription', entityId: id, request });
        return { message: 'Prescrição removida' };
    });
}
