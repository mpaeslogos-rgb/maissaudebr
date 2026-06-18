"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insurancePlansRoutes = insurancePlansRoutes;
const zod_1 = require("zod");
const prisma2_1 = require("../lib/prisma2");
const auth_1 = require("../plugins/auth");
const requireAuth = (0, auth_1.requireRole)('ADMIN', 'RECEPTIONIST');
const planSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    ansCode: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional().or(zod_1.z.literal("")),
    isActive: zod_1.z.boolean().optional(),
});
const contractSchema = zod_1.z.object({
    planId: zod_1.z.string(),
    startDate: zod_1.z.string().datetime(),
    endDate: zod_1.z.string().datetime().optional(),
    consultationFee: zod_1.z.number().nonnegative().optional(),
    notes: zod_1.z.string().optional(),
});
const procedureSchema = zod_1.z.object({
    contractId: zod_1.z.string(),
    tussCode: zod_1.z.string().min(1),
    description: zod_1.z.string().min(1),
    price: zod_1.z.number().nonnegative(),
});
async function insurancePlansRoutes(app) {
    // ── Planos ───────────────────────────────────────────────────────────────
    app.get("/insurance-plans", { preHandler: [(0, auth_1.requireRole)('ADMIN', 'RECEPTIONIST', 'DOCTOR')] }, async (req, reply) => {
        const plans = await prisma2_1.prisma.insurancePlan.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
            include: { contracts: { include: { procedures: true } } },
        });
        return reply.send(plans);
    });
    app.post("/insurance-plans", { preHandler: [requireAuth] }, async (req, reply) => {
        const data = planSchema.parse(req.body);
        const plan = await prisma2_1.prisma.insurancePlan.create({ data });
        return reply.status(201).send(plan);
    });
    app.patch("/insurance-plans/:id", { preHandler: [requireAuth] }, async (req, reply) => {
        const { id } = req.params;
        const data = planSchema.partial().parse(req.body);
        const plan = await prisma2_1.prisma.insurancePlan.update({ where: { id }, data });
        return reply.send(plan);
    });
    app.delete("/insurance-plans/:id", { preHandler: [requireAuth] }, async (req, reply) => {
        const { id } = req.params;
        await prisma2_1.prisma.insurancePlan.update({ where: { id }, data: { isActive: false } });
        return reply.status(204).send();
    });
    // ── Contratos ─────────────────────────────────────────────────────────────
    app.post("/insurance-contracts", { preHandler: [requireAuth] }, async (req, reply) => {
        const data = contractSchema.parse(req.body);
        const contract = await prisma2_1.prisma.insuranceContract.create({
            data: { ...data, startDate: new Date(data.startDate), endDate: data.endDate ? new Date(data.endDate) : undefined },
        });
        return reply.status(201).send(contract);
    });
    app.patch("/insurance-contracts/:id", { preHandler: [requireAuth] }, async (req, reply) => {
        const { id } = req.params;
        const data = contractSchema.partial().omit({ planId: true }).parse(req.body);
        const contract = await prisma2_1.prisma.insuranceContract.update({
            where: { id },
            data: {
                ...data,
                ...(data.startDate && { startDate: new Date(data.startDate) }),
                ...(data.endDate && { endDate: new Date(data.endDate) }),
            },
        });
        return reply.send(contract);
    });
    app.delete("/insurance-contracts/:id", { preHandler: [requireAuth] }, async (req, reply) => {
        const { id } = req.params;
        await prisma2_1.prisma.insuranceContract.delete({ where: { id } });
        return reply.status(204).send();
    });
    // ── Procedimentos ─────────────────────────────────────────────────────────
    app.post("/insurance-procedures", { preHandler: [requireAuth] }, async (req, reply) => {
        const data = procedureSchema.parse(req.body);
        const proc = await prisma2_1.prisma.insuranceProcedure.create({ data });
        return reply.status(201).send(proc);
    });
    app.patch("/insurance-procedures/:id", { preHandler: [requireAuth] }, async (req, reply) => {
        const { id } = req.params;
        const data = procedureSchema.partial().omit({ contractId: true }).parse(req.body);
        const proc = await prisma2_1.prisma.insuranceProcedure.update({ where: { id }, data });
        return reply.send(proc);
    });
    app.delete("/insurance-procedures/:id", { preHandler: [requireAuth] }, async (req, reply) => {
        const { id } = req.params;
        await prisma2_1.prisma.insuranceProcedure.delete({ where: { id } });
        return reply.status(204).send();
    });
}
