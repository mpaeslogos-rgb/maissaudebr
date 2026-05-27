"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cashflowRoutes = cashflowRoutes;
const zod_1 = require("zod");
const auth_1 = require("../plugins/auth");
const prisma2_1 = require("../lib/prisma2");
const querySchema = zod_1.z.object({
    months: zod_1.z.coerce.number().int().min(1).max(24).default(12),
});
function monthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
function addMonths(date, n) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + n);
    return d;
}
function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}
function endOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}
async function cashflowRoutes(app) {
    app.addHook('preHandler', (0, auth_1.requireRole)('ADMIN', 'RECEPTIONIST'));
    // GET /api/financeiro/cashflow?months=12
    app.get('/financeiro/cashflow', async (request, reply) => {
        const parsed = querySchema.safeParse(request.query);
        if (!parsed.success)
            return reply.code(400).send({ error: parsed.error.flatten() });
        const { months } = parsed.data;
        const now = new Date();
        const fromDate = startOfMonth(addMonths(now, -(months - 1)));
        // Buscar pagamentos PAID e PENDING no período
        const [paidPayments, paidPayables, pendingPayments, pendingPayables] = await Promise.all([
            prisma2_1.prisma.payment.findMany({
                where: { status: 'PAID', paidAt: { gte: fromDate } },
                select: { amount: true, paidAt: true },
            }),
            prisma2_1.prisma.accountPayable.findMany({
                where: { status: 'PAID', paidAt: { gte: fromDate } },
                select: { amount: true, paidAt: true },
            }),
            prisma2_1.prisma.payment.findMany({
                where: { status: 'PENDING', dueDate: { gte: fromDate } },
                select: { amount: true, dueDate: true },
            }),
            prisma2_1.prisma.accountPayable.findMany({
                where: { status: 'PENDING', dueDate: { gte: fromDate } },
                select: { amount: true, dueDate: true },
            }),
        ]);
        // Montar meses no intervalo
        const monthsMap = {};
        for (let i = 0; i < months; i++) {
            const key = monthKey(addMonths(fromDate, i));
            monthsMap[key] = { entradas: 0, saidas: 0, projecaoEntradas: 0, projecaoSaidas: 0 };
        }
        for (const p of paidPayments) {
            if (!p.paidAt)
                continue;
            const key = monthKey(new Date(p.paidAt));
            if (monthsMap[key])
                monthsMap[key].entradas += Number(p.amount);
        }
        for (const p of paidPayables) {
            if (!p.paidAt)
                continue;
            const key = monthKey(new Date(p.paidAt));
            if (monthsMap[key])
                monthsMap[key].saidas += Number(p.amount);
        }
        for (const p of pendingPayments) {
            const key = monthKey(new Date(p.dueDate));
            if (monthsMap[key])
                monthsMap[key].projecaoEntradas += Number(p.amount);
        }
        for (const p of pendingPayables) {
            const key = monthKey(new Date(p.dueDate));
            if (monthsMap[key])
                monthsMap[key].projecaoSaidas += Number(p.amount);
        }
        let saldoAcumulado = 0;
        const monthsArray = Object.entries(monthsMap).map(([month, v]) => {
            saldoAcumulado += v.entradas - v.saidas;
            return { month, ...v, saldo: v.entradas - v.saidas, saldoAcumulado };
        });
        // Projeções: pendentes e próximos 30 dias
        const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const [pendingPaymentsAgg, pendingPayablesAgg, upcoming30In, upcoming30Out] = await Promise.all([
            prisma2_1.prisma.payment.aggregate({
                where: { status: 'PENDING' },
                _sum: { amount: true },
                _count: { _all: true },
            }),
            prisma2_1.prisma.accountPayable.aggregate({
                where: { status: 'PENDING' },
                _sum: { amount: true },
                _count: { _all: true },
            }),
            prisma2_1.prisma.payment.aggregate({
                where: { status: 'PENDING', dueDate: { gte: now, lte: in30 } },
                _sum: { amount: true },
                _count: { _all: true },
            }),
            prisma2_1.prisma.accountPayable.aggregate({
                where: { status: 'PENDING', dueDate: { gte: now, lte: in30 } },
                _sum: { amount: true },
                _count: { _all: true },
            }),
        ]);
        // Vencidos (PENDING + dueDate < now)
        const [overdueIn, overdueOut] = await Promise.all([
            prisma2_1.prisma.payment.aggregate({
                where: { status: 'PENDING', dueDate: { lt: now } },
                _sum: { amount: true },
                _count: { _all: true },
            }),
            prisma2_1.prisma.accountPayable.aggregate({
                where: { status: 'PENDING', dueDate: { lt: now } },
                _sum: { amount: true },
                _count: { _all: true },
            }),
        ]);
        // Mês atual
        const thisMonthStart = startOfMonth(now);
        const thisMonthEnd = endOfMonth(now);
        const [thisMonthIn, thisMonthOut] = await Promise.all([
            prisma2_1.prisma.payment.aggregate({
                where: { status: 'PAID', paidAt: { gte: thisMonthStart, lte: thisMonthEnd } },
                _sum: { amount: true },
            }),
            prisma2_1.prisma.accountPayable.aggregate({
                where: { status: 'PAID', paidAt: { gte: thisMonthStart, lte: thisMonthEnd } },
                _sum: { amount: true },
            }),
        ]);
        const n = (v) => Number(v ?? 0);
        return reply.send({
            months: monthsArray,
            totals: {
                entradas: monthsArray.reduce((s, m) => s + m.entradas, 0),
                saidas: monthsArray.reduce((s, m) => s + m.saidas, 0),
                saldo: saldoAcumulado,
            },
            current: {
                thisMonthEntradas: n(thisMonthIn._sum.amount),
                thisMonthSaidas: n(thisMonthOut._sum.amount),
                thisMonthSaldo: n(thisMonthIn._sum.amount) - n(thisMonthOut._sum.amount),
                pendingEntradas: n(pendingPaymentsAgg._sum.amount),
                pendingEntradasCount: pendingPaymentsAgg._count._all,
                pendingSaidas: n(pendingPayablesAgg._sum.amount),
                pendingSaidasCount: pendingPayablesAgg._count._all,
                overdueEntradas: n(overdueIn._sum.amount),
                overdueEntradasCount: overdueIn._count._all,
                overdueSaidas: n(overdueOut._sum.amount),
                overdueSaidasCount: overdueOut._count._all,
                upcoming30Entradas: n(upcoming30In._sum.amount),
                upcoming30EntradasCount: upcoming30In._count._all,
                upcoming30Saidas: n(upcoming30Out._sum.amount),
                upcoming30SaidasCount: upcoming30Out._count._all,
            },
        });
    });
}
