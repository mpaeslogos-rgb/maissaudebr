"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stockRoutes = stockRoutes;
const zod_1 = require("zod");
const prisma2_1 = require("../lib/prisma2");
const auth_1 = require("../plugins/auth");
const requireAuth = (0, auth_1.requireRole)('ADMIN', 'RECEPTIONIST');
const materialSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    unit: zod_1.z.string().min(1),
    minStock: zod_1.z.number().nonnegative().optional(),
    currentStock: zod_1.z.number().nonnegative().optional(),
    costPrice: zod_1.z.number().nonnegative().optional(),
    isActive: zod_1.z.boolean().optional(),
});
const movementSchema = zod_1.z.object({
    materialId: zod_1.z.string(),
    type: zod_1.z.enum(["IN", "OUT"]),
    quantity: zod_1.z.number().positive(),
    reason: zod_1.z.string().optional(),
    appointmentId: zod_1.z.string().optional(),
});
async function stockRoutes(app) {
    // ── Materiais ─────────────────────────────────────────────────────────────
    app.get("/materials", { preHandler: [requireAuth] }, async (req, reply) => {
        const materials = await prisma2_1.prisma.material.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
        });
        return reply.send(materials);
    });
    app.post("/materials", { preHandler: [requireAuth] }, async (req, reply) => {
        const data = materialSchema.parse(req.body);
        const mat = await prisma2_1.prisma.material.create({ data });
        return reply.status(201).send(mat);
    });
    app.patch("/materials/:id", { preHandler: [requireAuth] }, async (req, reply) => {
        const { id } = req.params;
        const data = materialSchema.partial().parse(req.body);
        const mat = await prisma2_1.prisma.material.update({ where: { id }, data });
        return reply.send(mat);
    });
    app.delete("/materials/:id", { preHandler: [requireAuth] }, async (req, reply) => {
        const { id } = req.params;
        await prisma2_1.prisma.material.update({ where: { id }, data: { isActive: false } });
        return reply.status(204).send();
    });
    // ── Movimentações ─────────────────────────────────────────────────────────
    app.get("/stock-movements", { preHandler: [requireAuth] }, async (req, reply) => {
        const { materialId } = req.query;
        const movements = await prisma2_1.prisma.stockMovement.findMany({
            where: { ...(materialId && { materialId }) },
            include: { material: { select: { id: true, name: true, unit: true } } },
            orderBy: { createdAt: "desc" },
            take: 200,
        });
        return reply.send(movements);
    });
    // Registrar entrada ou saída — atualiza saldo do material atomicamente
    app.post("/stock-movements", { preHandler: [requireAuth] }, async (req, reply) => {
        const body = movementSchema.parse(req.body);
        const user = (0, auth_1.getPayload)(req);
        const result = await prisma2_1.prisma.$transaction(async (tx) => {
            const material = await tx.material.findUniqueOrThrow({ where: { id: body.materialId } });
            const newStock = body.type === "IN"
                ? material.currentStock + body.quantity
                : material.currentStock - body.quantity;
            if (newStock < 0)
                throw new Error("Estoque insuficiente");
            await tx.material.update({
                where: { id: body.materialId },
                data: { currentStock: newStock },
            });
            return tx.stockMovement.create({
                data: { ...body, userId: user.sub },
                include: { material: { select: { id: true, name: true, unit: true, currentStock: true } } },
            });
        });
        return reply.status(201).send(result);
    });
}
