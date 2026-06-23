"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.examCatalogRoutes = examCatalogRoutes;
const zod_1 = require("zod");
const prisma2_1 = require("../lib/prisma2");
const auth_1 = require("../plugins/auth");
const requireAuth = (0, auth_1.requireRole)('ADMIN', 'DOCTOR', 'RECEPTIONIST');
const catalogSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    tussCode: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    price: zod_1.z.number().positive(),
    duration: zod_1.z.number().int().positive().optional(),
    repasseType: zod_1.z.enum(["PERCENTAGE", "FIXED"]).optional(),
    repasseValue: zod_1.z.number().nonnegative().optional(),
    isActive: zod_1.z.boolean().optional(),
});
async function examCatalogRoutes(app) {
    // Listar
    app.get("/exam-catalog", { preHandler: [requireAuth] }, async (req, reply) => {
        const items = await prisma2_1.prisma.examCatalog.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
        });
        return reply.send(items);
    });
    // Criar
    app.post("/exam-catalog", { preHandler: [requireAuth] }, async (req, reply) => {
        const data = catalogSchema.parse(req.body);
        const item = await prisma2_1.prisma.examCatalog.create({ data });
        return reply.status(201).send(item);
    });
    // Atualizar
    app.patch("/exam-catalog/:id", { preHandler: [requireAuth] }, async (req, reply) => {
        const { id } = req.params;
        const data = catalogSchema.partial().parse(req.body);
        const item = await prisma2_1.prisma.examCatalog.update({ where: { id }, data });
        return reply.send(item);
    });
    // Deletar (soft: isActive = false)
    app.delete("/exam-catalog/:id", { preHandler: [requireAuth] }, async (req, reply) => {
        const { id } = req.params;
        await prisma2_1.prisma.examCatalog.update({ where: { id }, data: { isActive: false } });
        return reply.status(204).send();
    });
}
