import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireRole } from '../plugins/auth'
import { prisma } from '../lib/prisma2'

const querySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(12),
})

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function addMonths(date: Date, n: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + n)
  return d
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

export async function cashflowRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('ADMIN', 'RECEPTIONIST'))

  // GET /api/financeiro/cashflow?months=12
  app.get('/financeiro/cashflow', async (request, reply) => {
    const parsed = querySchema.safeParse(request.query)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    const { months } = parsed.data
    const now = new Date()
    const fromDate = startOfMonth(addMonths(now, -(months - 1)))

    // Buscar todos os pagamentos PAID no período
    const [paidPayments, paidPayables] = await Promise.all([
      prisma.payment.findMany({
        where: { status: 'PAID', paidAt: { gte: fromDate } },
        select: { amount: true, paidAt: true },
      }),
      prisma.accountPayable.findMany({
        where: { status: 'PAID', paidAt: { gte: fromDate } },
        select: { amount: true, paidAt: true },
      }),
    ])

    // Montar meses no intervalo
    const monthsMap: Record<string, { entradas: number; saidas: number }> = {}
    for (let i = 0; i < months; i++) {
      const key = monthKey(addMonths(fromDate, i))
      monthsMap[key] = { entradas: 0, saidas: 0 }
    }

    for (const p of paidPayments) {
      if (!p.paidAt) continue
      const key = monthKey(new Date(p.paidAt))
      if (monthsMap[key]) monthsMap[key].entradas += Number(p.amount)
    }
    for (const p of paidPayables) {
      if (!p.paidAt) continue
      const key = monthKey(new Date(p.paidAt))
      if (monthsMap[key]) monthsMap[key].saidas += Number(p.amount)
    }

    let saldoAcumulado = 0
    const monthsArray = Object.entries(monthsMap).map(([month, v]) => {
      saldoAcumulado += v.entradas - v.saidas
      return { month, ...v, saldo: v.entradas - v.saidas, saldoAcumulado }
    })

    // Projeções: pendentes e próximos 30 dias
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const [pendingPayments, pendingPayables, upcoming30In, upcoming30Out] = await Promise.all([
      prisma.payment.aggregate({
        where: { status: 'PENDING' },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.accountPayable.aggregate({
        where: { status: 'PENDING' },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.payment.aggregate({
        where: { status: 'PENDING', dueDate: { gte: now, lte: in30 } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.accountPayable.aggregate({
        where: { status: 'PENDING', dueDate: { gte: now, lte: in30 } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ])

    // Vencidos (PENDING + dueDate < now)
    const [overdueIn, overdueOut] = await Promise.all([
      prisma.payment.aggregate({
        where: { status: 'PENDING', dueDate: { lt: now } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.accountPayable.aggregate({
        where: { status: 'PENDING', dueDate: { lt: now } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ])

    // Mês atual
    const thisMonthStart = startOfMonth(now)
    const thisMonthEnd   = endOfMonth(now)
    const [thisMonthIn, thisMonthOut] = await Promise.all([
      prisma.payment.aggregate({
        where: { status: 'PAID', paidAt: { gte: thisMonthStart, lte: thisMonthEnd } },
        _sum: { amount: true },
      }),
      prisma.accountPayable.aggregate({
        where: { status: 'PAID', paidAt: { gte: thisMonthStart, lte: thisMonthEnd } },
        _sum: { amount: true },
      }),
    ])

    const n = (v: number | null) => Number(v ?? 0)

    return reply.send({
      months: monthsArray,
      totals: {
        entradas:        monthsArray.reduce((s, m) => s + m.entradas, 0),
        saidas:          monthsArray.reduce((s, m) => s + m.saidas,   0),
        saldo:           saldoAcumulado,
      },
      current: {
        thisMonthEntradas:    n(thisMonthIn._sum.amount),
        thisMonthSaidas:      n(thisMonthOut._sum.amount),
        thisMonthSaldo:       n(thisMonthIn._sum.amount) - n(thisMonthOut._sum.amount),
        pendingEntradas:      n(pendingPayments._sum.amount),
        pendingEntradasCount: pendingPayments._count._all,
        pendingSaidas:        n(pendingPayables._sum.amount),
        pendingSaidasCount:   pendingPayables._count._all,
        overdueEntradas:      n(overdueIn._sum.amount),
        overdueEntradasCount: overdueIn._count._all,
        overdueSaidas:        n(overdueOut._sum.amount),
        overdueSaidasCount:   overdueOut._count._all,
        upcoming30Entradas:      n(upcoming30In._sum.amount),
        upcoming30EntradasCount: upcoming30In._count._all,
        upcoming30Saidas:        n(upcoming30Out._sum.amount),
        upcoming30SaidasCount:   upcoming30Out._count._all,
      },
    })
  })
}
