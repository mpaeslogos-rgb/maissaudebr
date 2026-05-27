"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTokenRevoked = isTokenRevoked;
exports.authRoutes = authRoutes;
const zod_1 = require("zod");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma2_1 = require("../lib/prisma2");
const audit_1 = require("../lib/audit");
const password_1 = require("../lib/password");
const auth_1 = require("../plugins/auth");
// Blocklist em memória com TTL. Para multi-instância use Redis.
const revokedTokens = new Map(); // jti → expiry (unix ms)
setInterval(() => {
    const now = Date.now();
    for (const [jti, exp] of revokedTokens) {
        if (exp < now)
            revokedTokens.delete(jti);
    }
}, 5 * 60 * 1000);
function isTokenRevoked(jti) {
    return revokedTokens.has(jti);
}
const registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    password: password_1.passwordSchema,
    role: zod_1.z.enum(['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'PATIENT']),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
});
async function authRoutes(app) {
    // 10 tentativas por 15 minutos por IP — proteção brute-force
    app.post('/auth/login', {
        config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    }, async (request, reply) => {
        const parsed = loginSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.flatten() });
        }
        const { email, password } = parsed.data;
        const user = await prisma2_1.prisma.user.findUnique({ where: { email } });
        if (!user || !user.isActive) {
            (0, audit_1.logAudit)({ userId: null, action: 'LOGIN_FAILED', entity: 'User', metadata: { email }, request });
            return reply.code(401).send({ error: 'Credenciais invalidas' });
        }
        const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!valid) {
            (0, audit_1.logAudit)({ userId: user.id, action: 'LOGIN_FAILED', entity: 'User', entityId: user.id, request });
            return reply.code(401).send({ error: 'Credenciais invalidas' });
        }
        const token = app.jwt.sign({ sub: user.id, role: user.role, name: user.name });
        (0, audit_1.logAudit)({ userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id, request });
        return reply.send({
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role },
        });
    });
    // POST /auth/logout — revoga o token atual até expirar
    app.post('/auth/logout', { preHandler: (0, auth_1.requireRole)('ADMIN', 'DOCTOR', 'RECEPTIONIST', 'PATIENT') }, async (request, reply) => {
        const payload = request.user;
        const tokenKey = request.headers.authorization?.split(' ')[1] ?? payload.sub;
        const exp = payload.exp ? payload.exp * 1000 : Date.now() + 8 * 60 * 60 * 1000;
        revokedTokens.set(tokenKey, exp);
        const uid = payload.sub ?? null;
        (0, audit_1.logAudit)({ userId: uid, action: 'LOGOUT', entity: 'User', entityId: uid, request });
        return reply.send({ message: 'Sessão encerrada.' });
    });
    app.post('/auth/register', async (request, reply) => {
        const parsed = registerSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.flatten() });
        }
        const { name, email, password, role } = parsed.data;
        const exists = await prisma2_1.prisma.user.findUnique({ where: { email } });
        if (exists) {
            return reply.code(409).send({ error: 'E-mail ja cadastrado' });
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        const user = await prisma2_1.prisma.user.create({
            data: { name, email, passwordHash, role },
            select: { id: true, name: true, email: true, role: true },
        });
        return reply.code(201).send(user);
    });
}
