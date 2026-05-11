import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Prisma, AccountPayableStatus } from '@prisma/client'
import { authenticate } from '../plugins/auth'
import { prisma } from '../lib/prisma'
import { extractUniqueViolationFields } from '../lib/prisma-errors'

// ============================================================
// SCHEMAS DE VALIDAÇÃO (Zod)
// ============================================================
// Schema (AccountPayable):
//   description (obrigatório), category?, supplier?, amount (Decimal),
//   status (default PENDING), dueDate, paidAt?, notes?
// Sem relações — CRUD direto.
// IDs são CUIDs: z.string().min(1) (NUNCA .uuid())

const statusEnum = z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED'])

// Por que z.coerce.number()? O front pode mandar "150.50" como string vindo de input HTML.
// O Prisma aceita number/string para Decimal — vamos padronizar para number aqui.
const amountSchema = z.coerce.number().positive('amount deve ser maior que zero')

const createSchema = z.object({
  description: z.string().min(2).max(500),
  category: z.string().max(100).optional(),
  supplier: z.string().max(200).optional(),
  amount: amountSchema,
  dueDate: z.coerce.date(),
  notes: z.string().max(2000).optional(),
})

const updateSchema = z.object({
  description: z.string().min(2).max(500).optional(),
  category: z.string().max(100).optional(),
  supplier: z.string().max(200).optional(),
  amount: amountSchema.optional(),
  status: statusEnum.optional(),
  dueDate: z.coerce.date().optional(),
  paidAt: z.coerce.date().nullable().optional(),
  notes: z.string().max(2000).optional(),
})

// Body opcional do endpoint /pay — permite informar quando foi pago e método (string livre).
// Por que opcional? Casos de uso: marcar como pago "agora" (sem body) ou registrar pagamento retroativo.
const paySchema = z.object({
  paidAt: z.coerce.date().optional(),
  notes: z.string().max(2000).optional(),
})

const idParamSchema = z.object({ id: z.string().min(1, 'ID inválido') })

const listQuerySchema = z.object({
  q: z.string().optional(), // busca em description/category/supplier
  status: statusEnum.optional(),
  category: z.string().optional(),
  from: z.coerce.date().optional(), // intervalo em dueDate
  to: z.coerce.date().optional(),
  overdueOnly: z.coerce.boolean().optional(), // atalho: dueDate < hoje && status PENDING
  take: z.coerce.number().int().positive().max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
})

// ============================================================
// MÁQUINA DE ESTADOS
// ============================================================
// Por que? Evita transições absurdas (ex: voltar de PAID para PENDING sem motivo).
// OVERDUE é geralmente derivado por job/cron, mas permitimos transição manual também.
const VALID_TRANSITIONS: Record<AccountPayableStatus, AccountPayableStatus[]> = {
  PENDING:   ['PAID', 'OVERDUE', 'CANCELLED'],
  OVERDUE:   ['PAID', 'CANCELLED'],
  PAID:      [], // estado terminal — pra "estornar", crie outra conta
  CANCELLED: [], // estado terminal
}

function isValidTransition(from: AccountPayableStatus, to: AccountPayableStatus): boolean {
  if (from === to) return true // idempotente
  return VALID_TRANSITIONS[from].includes(to)
}

// ============================================================
// ROTAS
// ============================================================
export async function accountsPayableRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  // ---------------------------------------------------------
  // POST /accounts-payable — criar despesa
  // ---------------------------------------------------------
  app.post('/accounts-payable', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() })
    }

    try {
      const created = await prisma.accountPayable.create({
        data: parsed.data,
      })
      return reply.code(201).send(created)
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = extractUniqueViolationFields(err.meta)
        return reply.code(409).send({
          error: `Já existe um registro com esse(s) campo(s): ${target}`,
        })
      }
      request.log.error(err)
      return reply.code(500).send({ error: 'Erro interno ao criar conta a pagar' })
    }
  })

  // ---------------------------------------------------------
  // GET /accounts-payable — listagem com filtros + paginação
  // ---------------------------------------------------------
  app.get('/accounts-payable', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() })
    }
    const { q, status, category, from, to, overdueOnly, take, skip } = parsed.data

    // Atalho overdueOnly: dueDate < agora E status PENDING
    // (não usamos OVERDUE aqui porque ele depende de job que pode não ter rodado)
    const overdueFilter: Prisma.AccountPayableWhereInput | undefined = overdueOnly
      ? { dueDate: { lt: new Date() }, status: 'PENDING' }
      : undefined

    const where: Prisma.AccountPayableWhereInput = {
      ...(overdueFilter ?? {}),
      // Se overdueOnly não foi passado, aplicar status normalmente
      ...(overdueFilter ? {} : { status }),
      category,
      ...(q
        ? {
            OR: [
              { description: { contains: q, mode: 'insensitive' } },
              { category: { contains: q, mode: 'insensitive' } },
              { supplier: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(from || to
        ? { dueDate: { gte: from ?? undefined, lte: to ?? undefined } }
        : {}),
    }

    const [data, total] = await Promise.all([
      prisma.accountPayable.findMany({
        where,
        take,
        skip,
        orderBy: { dueDate: 'asc' }, // mais urgentes primeiro
      }),
      prisma.accountPayable.count({ where }),
    ])

    return reply.send({ data, total, take, skip })
  })

  // ---------------------------------------------------------
  // GET /accounts-payable/summary — totais por status
  // ---------------------------------------------------------
  // IMPORTANTE: definida ANTES de /:id para não colidir com a rota dinâmica.
  // Útil pro dashboard: quanto a clínica deve hoje, quanto venceu, etc.
  app.get('/accounts-payable/summary', async (_request, reply) => {
    const groups = await prisma.accountPayable.groupBy({
      by: ['status'],
      _sum: { amount: true },
      _count: { _all: true },
    })

    // Calcular total vencido (dueDate < agora E status PENDING)
    const overdueAgg = await prisma.accountPayable.aggregate({
      where: { dueDate: { lt: new Date() }, status: 'PENDING' },
      _sum: { amount: true },
      _count: { _all: true },
    })

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
    })
  })

  // ---------------------------------------------------------
  // GET /accounts-payable/:id — detalhe
  // ---------------------------------------------------------
  app.get('/accounts-payable/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() })
    }

    const found = await prisma.accountPayable.findUnique({
      where: { id: parsed.data.id },
    })

    if (!found) return reply.code(404).send({ error: 'Conta a pagar não encontrada' })
    return reply.send(found)
  })

  // ---------------------------------------------------------
  // PATCH /accounts-payable/:id — atualizar
  // ---------------------------------------------------------
  app.patch('/accounts-payable/:id', async (request, reply) => {
    const params = idParamSchema.safeParse(request.params)
    const body = updateSchema.safeParse(request.body)
    if (!params.success) return reply.code(400).send({ error: params.error.flatten() })
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    try {
      // Validar transição de status, se houver
      if (body.data.status) {
        const current = await prisma.accountPayable.findUnique({
          where: { id: params.data.id },
          select: { status: true },
        })
        if (!current) {
          return reply.code(404).send({ error: 'Conta a pagar não encontrada' })
        }
        if (!isValidTransition(current.status, body.data.status)) {
          return reply.code(422).send({
            error: `Transição de status inválida: ${current.status} → ${body.data.status}`,
            allowed: VALID_TRANSITIONS[current.status],
          })
        }
      }

      const updated = await prisma.accountPayable.update({
        where: { id: params.data.id },
        data: body.data,
      })
      return reply.send(updated)
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2025') {
          return reply.code(404).send({ error: 'Conta a pagar não encontrada' })
        }
        if (err.code === 'P2002') {
          const target = extractUniqueViolationFields(err.meta)
          return reply.code(409).send({
            error: `Já existe um registro com esse(s) campo(s): ${target}`,
          })
        }
      }
      request.log.error(err)
      return reply.code(500).send({ error: 'Erro interno ao atualizar conta a pagar' })
    }
  })

  // ---------------------------------------------------------
  // POST /accounts-payable/:id/pay — atalho para marcar como PAID
  // ---------------------------------------------------------
  // Por que um endpoint dedicado? "Pagar conta" é uma ação semântica frequente no
  // dashboard financeiro. Mais legível no front que PATCH com status+paidAt manual.
  app.post('/accounts-payable/:id/pay', async (request, reply) => {
    const params = idParamSchema.safeParse(request.params)
    // Body é opcional — request.body pode ser undefined em POST sem corpo
    const body = paySchema.safeParse(request.body ?? {})
    if (!params.success) return reply.code(400).send({ error: params.error.flatten() })
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    try {
      const current = await prisma.accountPayable.findUnique({
        where: { id: params.data.id },
        select: { status: true, notes: true },
      })
      if (!current) {
        return reply.code(404).send({ error: 'Conta a pagar não encontrada' })
      }
      if (current.status === 'PAID') {
        return reply.code(409).send({ error: 'Conta já está paga' })
      }
      if (current.status === 'CANCELLED') {
        return reply.code(409).send({ error: 'Conta cancelada não pode ser paga' })
      }

      const paid = await prisma.accountPayable.update({
        where: { id: params.data.id },
        data: {
          status: 'PAID',
          paidAt: body.data.paidAt ?? new Date(),
          ...(body.data.notes ? { notes: body.data.notes } : {}),
        },
      })
      return reply.send(paid)
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return reply.code(404).send({ error: 'Conta a pagar não encontrada' })
      }
      request.log.error(err)
      return reply.code(500).send({ error: 'Erro interno ao registrar pagamento' })
    }
  })

  // ---------------------------------------------------------
  // DELETE /accounts-payable/:id — soft cancel (status: CANCELLED)
  // ---------------------------------------------------------
  // Por que soft? Auditoria contábil exige histórico — não apagamos registros financeiros.
  app.delete('/accounts-payable/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    try {
      const current = await prisma.accountPayable.findUnique({
        where: { id: parsed.data.id },
        select: { status: true },
      })
      if (!current) return reply.code(404).send({ error: 'Conta a pagar não encontrada' })

      if (current.status === 'CANCELLED') {
        return reply.code(409).send({ error: 'Conta já está cancelada' })
      }
      if (current.status === 'PAID') {
        return reply.code(409).send({ error: 'Conta paga não pode ser cancelada' })
      }

      const cancelled = await prisma.accountPayable.update({
        where: { id: parsed.data.id },
        data: { status: 'CANCELLED' },
      })
      return reply.send(cancelled)
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return reply.code(404).send({ error: 'Conta a pagar não encontrada' })
      }
      request.log.error(err)
      return reply.code(500).send({ error: 'Erro interno ao cancelar conta a pagar' })
    }
  })
}