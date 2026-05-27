"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditRoutes = auditRoutes;
const zod_1 = require("zod");
const auth_1 = require("../plugins/auth");
const prisma2_1 = require("../lib/prisma2");
const listQuerySchema = zod_1.z.object({
    entity: zod_1.z.string().optional(),
    action: zod_1.z.string().optional(),
    userId: zod_1.z.string().optional(),
    search: zod_1.z.string().optional(),
    from: zod_1.z.coerce.date().optional(),
    to: zod_1.z.coerce.date().optional(),
    take: zod_1.z.coerce.number().int().positive().max(200).default(50),
    skip: zod_1.z.coerce.number().int().nonnegative().default(0),
});
async function auditRoutes(app) {
    app.addHook('preHandler', (0, auth_1.requireRole)('ADMIN'));
    // GET /api/audit-logs
    app.get('/audit-logs', async (request, reply) => {
        const parsed = listQuerySchema.safeParse(request.query);
        if (!parsed.success)
            return reply.code(400).send({ error: parsed.error.flatten() });
        const { entity, action, userId, search, from, to, take, skip } = parsed.data;
        const where = {
            ...(entity ? { entity } : {}),
            ...(action ? { action } : {}),
            ...(userId ? { userId } : {}),
            ...(from || to
                ? { createdAt: { gte: from ?? undefined, lte: to ?? undefined } }
                : {}),
            ...(search
                ? { OR: [
                        { entity: { contains: search, mode: 'insensitive' } },
                        { action: { contains: search, mode: 'insensitive' } },
                        { entityId: { contains: search } },
                    ] }
                : {}),
        };
        const [data, total] = await Promise.all([
            prisma2_1.prisma.auditLog.findMany({
                where,
                include: {
                    user: { select: { id: true, name: true, email: true, role: true } },
                },
                orderBy: { createdAt: 'desc' },
                take,
                skip,
            }),
            prisma2_1.prisma.auditLog.count({ where }),
        ]);
        return reply.send({ data, total, take, skip });
    });
    // GET /api/audit-logs/summary — contagem por ação e entidade nos últimos 30 dias
    app.get('/audit-logs/summary', async (_request, reply) => {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const [byAction, byEntity, recentUsers] = await Promise.all([
            prisma2_1.prisma.auditLog.groupBy({
                by: ['action'],
                where: { createdAt: { gte: since } },
                _count: { _all: true },
                orderBy: { _count: { action: 'desc' } },
            }),
            prisma2_1.prisma.auditLog.groupBy({
                by: ['entity'],
                where: { createdAt: { gte: since } },
                _count: { _all: true },
                orderBy: { _count: { entity: 'desc' } },
            }),
            prisma2_1.prisma.auditLog.findMany({
                where: { createdAt: { gte: since }, userId: { not: null } },
                select: {
                    userId: true,
                    user: { select: { name: true, email: true } },
                    createdAt: true,
                    action: true,
                    entity: true,
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
                distinct: ['userId'],
            }),
        ]);
        return reply.send({
            byAction: byAction.map(r => ({ action: r.action, count: r._count._all })),
            byEntity: byEntity.map(r => ({ entity: r.entity, count: r._count._all })),
            recentUsers: recentUsers.map(r => ({
                userId: r.userId,
                name: r.user?.name,
                email: r.user?.email,
                lastAction: r.action,
                lastEntity: r.entity,
                at: r.createdAt,
            })),
        });
    });
    // GET /api/audit-logs/:id
    app.get('/audit-logs/:id', async (request, reply) => {
        const { id } = request.params;
        const log = await prisma2_1.prisma.auditLog.findUnique({
            where: { id },
            include: { user: { select: { id: true, name: true, email: true, role: true } } },
        });
        if (!log)
            return reply.code(404).send({ error: 'Registro não encontrado.' });
        return reply.send(log);
    });
}
