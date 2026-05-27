"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountsPayableRoutes = accountsPayableRoutes;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const auth_1 = require("../plugins/auth");
const prisma2_1 = require("../lib/prisma2");
const prisma_errors_1 = require("../lib/prisma-errors");
const audit_1 = require("../lib/audit");
// ============================================================
// SCHEMAS DE VALIDAÇÃO (Zod)
// ============================================================
// Schema (AccountPayable):
//   description (obrigatório), category?, supplier?, amount (Decimal),
//   status (default PENDING), dueDate, paidAt?, notes?
// Sem relações — CRUD direto.
// IDs são CUIDs: z.string().min(1) (NUNCA .uuid())
const statusEnum = zod_1.z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']);
// Por que z.coerce.number()? O front pode mandar "150.50" como string vindo de input HTML.
// O Prisma aceita number/string para Decimal — vamos padronizar para number aqui.
const amountSchema = zod_1.z.coerce.number().positive('amount deve ser maior que zero');
const createSchema = zod_1.z.object({
    description: zod_1.z.string().min(2).max(500),
    category: zod_1.z.string().max(100).optional(),
    supplier: zod_1.z.string().max(200).optional(),
    amount: amountSchema,
    dueDate: zod_1.z.coerce.date(),
    notes: zod_1.z.string().max(2000).optional(),
});
const updateSchema = zod_1.z.object({
    description: zod_1.z.string().min(2).max(500).optional(),
    category: zod_1.z.string().max(100).optional(),
    supplier: zod_1.z.string().max(200).optional(),
    amount: amountSchema.optional(),
    status: statusEnum.optional(),
    dueDate: zod_1.z.coerce.date().optional(),
    paidAt: zod_1.z.coerce.date().nullable().optional(),
    notes: zod_1.z.string().max(2000).optional(),
});
// Body opcional do endpoint /pay — permite informar quando foi pago e método (string livre).
// Por que opcional? Casos de uso: marcar como pago "agora" (sem body) ou registrar pagamento retroativo.
const paySchema = zod_1.z.object({
    paidAt: zod_1.z.coerce.date().optional(),
    notes: zod_1.z.string().max(2000).optional(),
});
const idParamSchema = zod_1.z.object({ id: zod_1.z.string().min(1, 'ID inválido') });
const listQuerySchema = zod_1.z.object({
    q: zod_1.z.string().optional(), // busca em description/category/supplier
    status: statusEnum.optional(),
    category: zod_1.z.string().optional(),
    from: zod_1.z.coerce.date().optional(), // intervalo em dueDate
    to: zod_1.z.coerce.date().optional(),
    overdueOnly: zod_1.z.coerce.boolean().optional(), // atalho: dueDate < hoje && status PENDING
    take: zod_1.z.coerce.number().int().positive().max(500).default(50),
    skip: zod_1.z.coerce.number().int().min(0).default(0),
});
// ============================================================
// MÁQUINA DE ESTADOS
// ============================================================
// Por que? Evita transições absurdas (ex: voltar de PAID para PENDING sem motivo).
// OVERDUE é geralmente derivado por job/cron, mas permitimos transição manual também.
const VALID_TRANSITIONS = {
    PENDING: ['PAID', 'OVERDUE', 'CANCELLED'],
    OVERDUE: ['PAID', 'CANCELLED'],
    PAID: [], // estado terminal — pra "estornar", crie outra conta
    CANCELLED: [], // estado terminal
};
function isValidTransition(from, to) {
    if (from === to)
        return true; // idempotente
    return VALID_TRANSITIONS[from].includes(to);
}
// ============================================================
// ROTAS
// ============================================================
async function accountsPayableRoutes(app) {
    app.addHook('preHandler', (0, auth_1.requireRole)('ADMIN', 'RECEPTIONIST'));
    // ---------------------------------------------------------
    // POST /accounts-payable — criar despesa
    // ---------------------------------------------------------
    app.post('/accounts-payable', async (request, reply) => {
        const parsed = createSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.flatten() });
        }
        try {
            const created = await prisma2_1.prisma.accountPayable.create({
                data: parsed.data,
            });
            const uid = request.user?.sub ?? null;
            (0, audit_1.logAudit)({ userId: uid, action: 'CREATE_ACCOUNT_PAYABLE', entity: 'AccountPayable', entityId: created.id, request });
            return reply.code(201).send(created);
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                const target = (0, prisma_errors_1.extractUniqueViolationFields)(err.meta);
                return reply.code(409).send({
                    error: `Já existe um registro com esse(s) campo(s): ${target}`,
                });
            }
            request.log.error(err);
            return reply.code(500).send({ error: 'Erro interno ao criar conta a pagar' });
        }
    });
    // ---------------------------------------------------------
    // GET /accounts-payable — listagem com filtros + paginação
    // ---------------------------------------------------------
    app.get('/accounts-payable', async (request, reply) => {
        const parsed = listQuerySchema.safeParse(request.query);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.flatten() });
        }
        const { q, status, category, from, to, overdueOnly, take, skip } = parsed.data;
        // Atalho overdueOnly: dueDate < agora E status PENDING
        // (não usamos OVERDUE aqui porque ele depende de job que pode não ter rodado)
        const overdueFilter = overdueOnly
            ? { dueDate: { lt: new Date() }, status: 'PENDING' }
            : undefined;
        const where = {
            ...(overdueFilter ?? {}),
            // Se overdueOnly não foi passado, aplicar status normalmente
            ...(overdueFilter ? {} : { status }),
            category,
            ...(q
                ? {
                    OR: [
                        { description: { contains: q } },
                        { category: { contains: q } },
                        { supplier: { contains: q } },
                    ],
                }
                : {}),
            ...(from || to
                ? { dueDate: { gte: from ?? undefined, lte: to ?? undefined } }
                : {}),
        };
        const [data, total] = await Promise.all([
            prisma2_1.prisma.accountPayable.findMany({
                where,
                take,
                skip,
                orderBy: { dueDate: 'asc' }, // mais urgentes primeiro
            }),
            prisma2_1.prisma.accountPayable.count({ where }),
        ]);
        return reply.send({ data, total, take, skip });
    });
    // ---------------------------------------------------------
    // GET /accounts-payable/summary — totais por status
    // ---------------------------------------------------------
    // IMPORTANTE: definida ANTES de /:id para não colidir com a rota dinâmica.
    // Útil pro dashboard: quanto a clínica deve hoje, quanto venceu, etc.
    app.get('/accounts-payable/summary', async (_request, reply) => {
        const groups = await prisma2_1.prisma.accountPayable.groupBy({
            by: ['status'],
            _sum: { amount: true },
            _count: { _all: true },
        });
        // Calcular total vencido (dueDate < agora E status PENDING)
        const overdueAgg = await prisma2_1.prisma.accountPayable.aggregate({
            where: { dueDate: { lt: new Date() }, status: 'PENDING' },
            _sum: { amount: true },
            _count: { _all: true },
        });
        return reply.send({
            byStatus: groups.map((g) => ({
                status: g.status,
                total: g._sum.amount ?? 0,
                count: g._count._all,
            })),
            overdue: {
                total: overdueAgg._sum.amount ?? 0,
                count: overdueAgg._count._all,
            },
        });
    });
    // ---------------------------------------------------------
    // GET /accounts-payable/:id — detalhe
    // ---------------------------------------------------------
    app.get('/accounts-payable/:id', async (request, reply) => {
        const parsed = idParamSchema.safeParse(request.params);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.flatten() });
        }
        const found = await prisma2_1.prisma.accountPayable.findUnique({
            where: { id: parsed.data.id },
        });
        if (!found)
            return reply.code(404).send({ error: 'Conta a pagar não encontrada' });
        return reply.send(found);
    });
    // ---------------------------------------------------------
    // PATCH /accounts-payable/:id — atualizar
    // ---------------------------------------------------------
    app.patch('/accounts-payable/:id', async (request, reply) => {
        const params = idParamSchema.safeParse(request.params);
        const body = updateSchema.safeParse(request.body);
        if (!params.success)
            return reply.code(400).send({ error: params.error.flatten() });
        if (!body.success)
            return reply.code(400).send({ error: body.error.flatten() });
        try {
            // Validar transição de status, se houver
            if (body.data.status) {
                const current = await prisma2_1.prisma.accountPayable.findUnique({
                    where: { id: params.data.id },
                    select: { status: true },
                });
                if (!current) {
                    return reply.code(404).send({ error: 'Conta a pagar não encontrada' });
                }
                if (!isValidTransition(current.status, body.data.status)) {
                    return reply.code(422).send({
                        error: `Transição de status inválida: ${current.status} → ${body.data.status}`,
                        allowed: VALID_TRANSITIONS[current.status],
                    });
                }
            }
            const updated = await prisma2_1.prisma.accountPayable.update({
                where: { id: params.data.id },
                data: body.data,
            });
            return reply.send(updated);
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                if (err.code === 'P2025') {
                    return reply.code(404).send({ error: 'Conta a pagar não encontrada' });
                }
                if (err.code === 'P2002') {
                    const target = (0, prisma_errors_1.extractUniqueViolationFields)(err.meta);
                    return reply.code(409).send({
                        error: `Já existe um registro com esse(s) campo(s): ${target}`,
                    });
                }
            }
            request.log.error(err);
            return reply.code(500).send({ error: 'Erro interno ao atualizar conta a pagar' });
        }
    });
    // ---------------------------------------------------------
    // POST /accounts-payable/:id/pay — atalho para marcar como PAID
    // ---------------------------------------------------------
    // Por que um endpoint dedicado? "Pagar conta" é uma ação semântica frequente no
    // dashboard financeiro. Mais legível no front que PATCH com status+paidAt manual.
    app.post('/accounts-payable/:id/pay', async (request, reply) => {
        const params = idParamSchema.safeParse(request.params);
        // Body é opcional — request.body pode ser undefined em POST sem corpo
        const body = paySchema.safeParse(request.body ?? {});
        if (!params.success)
            return reply.code(400).send({ error: params.error.flatten() });
        if (!body.success)
            return reply.code(400).send({ error: body.error.flatten() });
        try {
            const current = await prisma2_1.prisma.accountPayable.findUnique({
                where: { id: params.data.id },
                select: { status: true, notes: true },
            });
            if (!current) {
                return reply.code(404).send({ error: 'Conta a pagar não encontrada' });
            }
            if (current.status === 'PAID') {
                return reply.code(409).send({ error: 'Conta já está paga' });
            }
            if (current.status === 'CANCELLED') {
                return reply.code(409).send({ error: 'Conta cancelada não pode ser paga' });
            }
            const paid = await prisma2_1.prisma.accountPayable.update({
                where: { id: params.data.id },
                data: {
                    status: 'PAID',
                    paidAt: body.data.paidAt ?? new Date(),
                    ...(body.data.notes ? { notes: body.data.notes } : {}),
                },
            });
            const uid = request.user?.sub ?? null;
            (0, audit_1.logAudit)({ userId: uid, action: 'PAY_ACCOUNT_PAYABLE', entity: 'AccountPayable', entityId: paid.id, request });
            return reply.send(paid);
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
                return reply.code(404).send({ error: 'Conta a pagar não encontrada' });
            }
            request.log.error(err);
            return reply.code(500).send({ error: 'Erro interno ao registrar pagamento' });
        }
    });
    // ---------------------------------------------------------
    // DELETE /accounts-payable/:id — soft cancel (status: CANCELLED)
    // ---------------------------------------------------------
    // Por que soft? Auditoria contábil exige histórico — não apagamos registros financeiros.
    app.delete('/accounts-payable/:id', async (request, reply) => {
        const parsed = idParamSchema.safeParse(request.params);
        if (!parsed.success)
            return reply.code(400).send({ error: parsed.error.flatten() });
        try {
            const current = await prisma2_1.prisma.accountPayable.findUnique({
                where: { id: parsed.data.id },
                select: { status: true },
            });
            if (!current)
                return reply.code(404).send({ error: 'Conta a pagar não encontrada' });
            if (current.status === 'CANCELLED') {
                return reply.code(409).send({ error: 'Conta já está cancelada' });
            }
            if (current.status === 'PAID') {
                return reply.code(409).send({ error: 'Conta paga não pode ser cancelada' });
            }
            const cancelled = await prisma2_1.prisma.accountPayable.update({
                where: { id: parsed.data.id },
                data: { status: 'CANCELLED' },
            });
            const uid = request.user?.sub ?? null;
            (0, audit_1.logAudit)({ userId: uid, action: 'CANCEL_ACCOUNT_PAYABLE', entity: 'AccountPayable', entityId: cancelled.id, request });
            return reply.send(cancelled);
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
                return reply.code(404).send({ error: 'Conta a pagar não encontrada' });
            }
            request.log.error(err);
            return reply.code(500).send({ error: 'Erro interno ao cancelar conta a pagar' });
        }
    });
}
