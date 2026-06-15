"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preventivoProgramsRoutes = preventivoProgramsRoutes;
const zod_1 = require("zod");
const prisma2_1 = require("../lib/prisma2");
const auth_1 = require("../plugins/auth");
const requireAuth = (0, auth_1.requireRole)('ADMIN', 'DOCTOR', 'RECEPTIONIST');
const programSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    durationDays: zod_1.z.number().int().positive(),
    monthlyFee: zod_1.z.number().nonnegative(),
    entryFee: zod_1.z.number().nonnegative().default(0),
    clinicScope: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional(),
});
async function preventivoProgramsRoutes(app) {
    app.get('/preventivo-programs', { preHandler: [requireAuth] }, async (_req, reply) => {
        const programs = await prisma2_1.prisma.preventivoProgram.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } },
            },
        });
        return reply.send(programs);
    });
    app.get('/preventivo-programs/:id', { preHandler: [requireAuth] }, async (req, reply) => {
        const { id } = req.params;
        const program = await prisma2_1.prisma.preventivoProgram.findUnique({
            where: { id },
            include: {
                enrollments: {
                    include: { patient: { select: { id: true, fullName: true, phone: true } } },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });
        if (!program)
            return reply.status(404).send({ error: 'Programa não encontrado' });
        return reply.send(program);
    });
    app.post('/preventivo-programs', { preHandler: [requireAuth] }, async (req, reply) => {
        const data = programSchema.parse(req.body);
        const program = await prisma2_1.prisma.preventivoProgram.create({ data });
        return reply.status(201).send(program);
    });
    app.patch('/preventivo-programs/:id', { preHandler: [requireAuth] }, async (req, reply) => {
        const { id } = req.params;
        const data = programSchema.partial().parse(req.body);
        const program = await prisma2_1.prisma.preventivoProgram.update({ where: { id }, data });
        return reply.send(program);
    });
    app.delete('/preventivo-programs/:id', { preHandler: [requireAuth] }, async (req, reply) => {
        const { id } = req.params;
        await prisma2_1.prisma.preventivoProgram.update({ where: { id }, data: { isActive: false } });
        return reply.status(204).send();
    });
}
