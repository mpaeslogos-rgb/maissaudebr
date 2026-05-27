"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRoutes = usersRoutes;
const zod_1 = require("zod");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = require("@prisma/client");
const auth_1 = require("../plugins/auth");
const prisma2_1 = require("../lib/prisma2");
const audit_1 = require("../lib/audit");
const password_1 = require("../lib/password");
const roleEnum = zod_1.z.enum(['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'PATIENT']);
const listQuerySchema = zod_1.z.object({
    q: zod_1.z.string().optional(),
    role: roleEnum.optional(),
    active: zod_1.z.coerce.boolean().optional(),
    take: zod_1.z.coerce.number().int().positive().max(100).default(50),
    skip: zod_1.z.coerce.number().int().nonnegative().default(0),
});
const createSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    name: zod_1.z.string().min(2).max(200),
    role: roleEnum,
    password: password_1.passwordSchema,
});
const updateSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(200).optional(),
    role: roleEnum.optional(),
    isActive: zod_1.z.boolean().optional(),
});
const resetPasswordSchema = zod_1.z.object({
    password: password_1.passwordSchema,
});
const SELECT_USER = {
    id: true,
    email: true,
    name: true,
    role: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
};
async function usersRoutes(app) {
    app.addHook('preHandler', (0, auth_1.requireRole)('ADMIN'));
    // GET /api/users
    app.get('/users', async (request, reply) => {
        const parsed = listQuerySchema.safeParse(request.query);
        if (!parsed.success)
            return reply.code(400).send({ error: parsed.error.flatten() });
        const { q, role, active, take, skip } = parsed.data;
        const where = {
            ...(role !== undefined ? { role } : {}),
            ...(active !== undefined ? { isActive: active } : {}),
            ...(q
                ? { OR: [
                        { name: { contains: q, mode: 'insensitive' } },
                        { email: { contains: q, mode: 'insensitive' } },
                    ] }
                : {}),
        };
        const [data, total] = await Promise.all([
            prisma2_1.prisma.user.findMany({ where, select: SELECT_USER, orderBy: { name: 'asc' }, take, skip }),
            prisma2_1.prisma.user.count({ where }),
        ]);
        return reply.send({ data, total, take, skip });
    });
    // GET /api/users/:id
    app.get('/users/:id', async (request, reply) => {
        const { id } = request.params;
        const user = await prisma2_1.prisma.user.findUnique({ where: { id }, select: SELECT_USER });
        if (!user)
            return reply.code(404).send({ error: 'Usuário não encontrado.' });
        return reply.send(user);
    });
    // POST /api/users
    app.post('/users', async (request, reply) => {
        const parsed = createSchema.safeParse(request.body);
        if (!parsed.success)
            return reply.code(400).send({ error: parsed.error.flatten() });
        const { email, name, role, password } = parsed.data;
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        try {
            const user = await prisma2_1.prisma.user.create({
                data: { email, name, role, passwordHash },
                select: SELECT_USER,
            });
            const uid = request.user?.sub ?? null;
            (0, audit_1.logAudit)({ userId: uid, action: 'CREATE_USER', entity: 'User', entityId: user.id, request });
            return reply.code(201).send(user);
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                return reply.code(409).send({ error: 'E-mail já cadastrado.' });
            }
            request.log.error(err);
            return reply.code(500).send({ error: 'Erro interno ao criar usuário.' });
        }
    });
    // PATCH /api/users/:id
    app.patch('/users/:id', async (request, reply) => {
        const { id } = request.params;
        const parsed = updateSchema.safeParse(request.body);
        if (!parsed.success)
            return reply.code(400).send({ error: parsed.error.flatten() });
        try {
            const user = await prisma2_1.prisma.user.update({
                where: { id },
                data: parsed.data,
                select: SELECT_USER,
            });
            const uid = request.user?.sub ?? null;
            (0, audit_1.logAudit)({ userId: uid, action: 'UPDATE_USER', entity: 'User', entityId: id, request });
            return reply.send(user);
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
                return reply.code(404).send({ error: 'Usuário não encontrado.' });
            }
            request.log.error(err);
            return reply.code(500).send({ error: 'Erro interno ao atualizar usuário.' });
        }
    });
    // POST /api/users/:id/reset-password
    app.post('/users/:id/reset-password', async (request, reply) => {
        const { id } = request.params;
        const parsed = resetPasswordSchema.safeParse(request.body);
        if (!parsed.success)
            return reply.code(400).send({ error: parsed.error.flatten() });
        const passwordHash = await bcryptjs_1.default.hash(parsed.data.password, 10);
        try {
            await prisma2_1.prisma.user.update({ where: { id }, data: { passwordHash } });
            const uid = request.user?.sub ?? null;
            (0, audit_1.logAudit)({ userId: uid, action: 'RESET_PASSWORD', entity: 'User', entityId: id, request });
            return reply.send({ success: true });
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
                return reply.code(404).send({ error: 'Usuário não encontrado.' });
            }
            request.log.error(err);
            return reply.code(500).send({ error: 'Erro interno ao redefinir senha.' });
        }
    });
    // DELETE /api/users/:id — desativa em vez de remover (soft delete)
    app.delete('/users/:id', async (request, reply) => {
        const { id } = request.params;
        try {
            await prisma2_1.prisma.user.update({ where: { id }, data: { isActive: false } });
            const uid = request.user?.sub ?? null;
            (0, audit_1.logAudit)({ userId: uid, action: 'DEACTIVATE_USER', entity: 'User', entityId: id, request });
            return reply.code(204).send();
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
                return reply.code(404).send({ error: 'Usuário não encontrado.' });
            }
            request.log.error(err);
            return reply.code(500).send({ error: 'Erro interno ao desativar usuário.' });
        }
    });
}
