"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.examPackagesRoutes = examPackagesRoutes;
const zod_1 = require("zod");
const prisma2_1 = require("../lib/prisma2");
const auth_1 = require("../plugins/auth");
const includeItems = {
    items: { include: { catalog: true } },
};
async function examPackagesRoutes(app) {
    const auth = (0, auth_1.requireRole)("ADMIN", "DOCTOR");
    app.get("/exam-packages", { preHandler: [auth] }, async (req, reply) => {
        const payload = (0, auth_1.getPayload)(req);
        const doctor = payload.role === "DOCTOR"
            ? await prisma2_1.prisma.doctor.findUnique({ where: { userId: payload.sub } })
            : null;
        const packages = await prisma2_1.prisma.examPackage.findMany({
            where: {
                OR: [
                    { doctorId: null },
                    ...(doctor ? [{ doctorId: doctor.id }] : []),
                    ...(payload.role === "ADMIN" ? [{}] : []),
                ],
            },
            include: includeItems,
            orderBy: { name: "asc" },
        });
        return reply.send(packages);
    });
    const createSchema = zod_1.z.object({
        name: zod_1.z.string().min(1),
        description: zod_1.z.string().optional(),
        catalogIds: zod_1.z.array(zod_1.z.string()).min(1).max(100),
        global: zod_1.z.boolean().optional(),
    });
    app.post("/exam-packages", { preHandler: [auth] }, async (req, reply) => {
        const data = createSchema.parse(req.body);
        const payload = (0, auth_1.getPayload)(req);
        let doctorId = null;
        if (data.global) {
            if (payload.role !== "ADMIN") {
                return reply.status(403).send({ error: "Apenas ADMIN pode criar pacotes globais." });
            }
        }
        else {
            const doctor = await prisma2_1.prisma.doctor.findUnique({ where: { userId: payload.sub } });
            if (!doctor)
                return reply.status(400).send({ error: "Médico não encontrado." });
            doctorId = doctor.id;
        }
        const pkg = await prisma2_1.prisma.examPackage.create({
            data: {
                name: data.name,
                description: data.description,
                doctorId,
                items: {
                    create: data.catalogIds.map((catalogId) => ({ catalogId })),
                },
            },
            include: includeItems,
        });
        return reply.status(201).send(pkg);
    });
    const updateSchema = zod_1.z.object({
        name: zod_1.z.string().min(1).optional(),
        description: zod_1.z.string().optional(),
        catalogIds: zod_1.z.array(zod_1.z.string()).min(1).max(100).optional(),
    });
    app.patch("/exam-packages/:id", { preHandler: [auth] }, async (req, reply) => {
        const { id } = req.params;
        const data = updateSchema.parse(req.body);
        const payload = (0, auth_1.getPayload)(req);
        const existing = await prisma2_1.prisma.examPackage.findUniqueOrThrow({ where: { id } });
        if (payload.role !== "ADMIN" && existing.doctorId) {
            const doctor = await prisma2_1.prisma.doctor.findUnique({ where: { userId: payload.sub } });
            if (existing.doctorId !== doctor?.id) {
                return reply.status(403).send({ error: "Sem permissão." });
            }
        }
        const pkg = await prisma2_1.prisma.$transaction(async (tx) => {
            if (data.catalogIds) {
                await tx.examPackageItem.deleteMany({ where: { packageId: id } });
                await tx.examPackageItem.createMany({
                    data: data.catalogIds.map((catalogId) => ({ packageId: id, catalogId })),
                });
            }
            return tx.examPackage.update({
                where: { id },
                data: {
                    ...(data.name && { name: data.name }),
                    ...(data.description !== undefined && { description: data.description }),
                },
                include: includeItems,
            });
        });
        return reply.send(pkg);
    });
    app.delete("/exam-packages/:id", { preHandler: [auth] }, async (req, reply) => {
        const { id } = req.params;
        const payload = (0, auth_1.getPayload)(req);
        const existing = await prisma2_1.prisma.examPackage.findUniqueOrThrow({ where: { id } });
        if (payload.role !== "ADMIN" && existing.doctorId) {
            const doctor = await prisma2_1.prisma.doctor.findUnique({ where: { userId: payload.sub } });
            if (existing.doctorId !== doctor?.id) {
                return reply.status(403).send({ error: "Sem permissão." });
            }
        }
        await prisma2_1.prisma.examPackage.delete({ where: { id } });
        return reply.status(204).send();
    });
}
