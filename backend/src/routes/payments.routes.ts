import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Prisma, PaymentMethod, PaymentStatus } from '@prisma/client'
import { requireRole } from '../plugins/auth'
import type { JwtPayload } from '../plugins/auth'
import { prisma } from '../lib/prisma2'
import { extractUniqueViolationFields } from '../lib/prisma-errors'
import { logAudit } from '../lib/audit'

// ============================================================
// SCHEMAS DE VALIDAÇÃO (Zod)
// ============================================================
// Schema Payment:
//   patientId (obrigatório), appointmentId? (UNIQUE 1:1),
//   amount (Decimal, obrigatório), status (default PENDING),
//   method? (opcional — pode criar cobrança sem método ainda),
//   dueDate (OBRIGATÓRIO!), paidAt?, description?, invoiceUrl?
//
// PaymentStatus: PENDING | PAID | OVERDUE | CANCELLED | REFUNDED
// PaymentMethod: CASH | CREDIT_CARD | DEBIT_CARD | PIX | BANK_TRANSFER | HEALTH_INSURANCE
// IDs são CUIDs: z.string().min(1)

const statusEnum = z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED'])

const methodEnum = z.enum([
  'CASH',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'PIX',
  'BANK_TRANSFER',
  'HEALTH_INSURANCE',
])

const amountSchema = z.coerce.number().positive('amount deve ser maior que zero')

const createSchema = z.object({
  patientId: z.string().min(1, 'patientId obrigatório'),
  appointmentId: z.string().min(1).optional(),
  amount: amountSchema,
  method: methodEnum.optional(), // opcional!
  status: statusEnum.optional(),
  dueDate: z.coerce.date(), // OBRIGATÓRIO no schema
  paidAt: z.coerce.date().optional(),
  description: z.string().max(500).optional(),
  invoiceUrl: z.string().url().optional(),
})

const updateSchema = z.object({
  amount: amountSchema.optional(),
  method: methodEnum.optional(),
  status: statusEnum.optional(),
  dueDate: z.coerce.date().optional(),
  paidAt: z.coerce.date().nullable().optional(),
  description: z.string().max(500).optional(),
  invoiceUrl: z.string().url().optional(),
})

const paySchema = z.object({
  method: methodEnum.optional(),
  paidAt: z.coerce.date().optional(),
})

const idParamSchema = z.object({ id: z.string().min(1, 'ID inválido') })

const listQuerySchema = z.object({
  patientId: z.string().min(1).optional(),
  appointmentId: z.string().min(1).optional(),
  status: statusEnum.optional(),
  method: methodEnum.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  dateField: z.enum(['createdAt', 'paidAt', 'dueDate']).default('createdAt'),
  overdueOnly: z.coerce.boolean().optional(),
  take: z.coerce.number().int().positive().max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
})

const summarySchema = z.object({
  patientId: z.string().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  dateField: z.enum(['createdAt', 'paidAt', 'dueDate']).default('paidAt'),
})

// ============================================================
// MÁQUINA DE ESTADOS
// ============================================================
// REFUNDED é um caso especial: só faz sentido a partir de PAID.
// Se quiser estornar uma cobrança PENDING, o correto é CANCELLED (nunca foi paga).
const VALID_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  PENDING:   ['PAID', 'OVERDUE', 'CANCELLED'],
  OVERDUE:   ['PAID', 'CANCELLED'],
  PAID:      ['REFUNDED'], // só dá pra estornar
  CANCELLED: [],           // terminal
  REFUNDED:  [],           // terminal
}

function isValidTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  if (from === to) return true
  return VALID_TRANSITIONS[from].includes(to)
}

// ============================================================
// HELPERS
// ============================================================

// Include padrão (sem vazar dados sensíveis do paciente como CPF, alergias, conv��nio)
const paymentInclude = {
  patient: {
    select: { id: true, fullName: true, email: true, phone: true },
  },
  appointment: {
    select: {
      id: true,
      startTime: true,
      endTime: true,
      status: true,
    },
  },
} satisfies Prisma.PaymentInclude

// ============================================================
// ROTAS
// ============================================================
export async function paymentsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('ADMIN', 'RECEPTIONIST'))

  // ---------------------------------------------------------
  // POST /payments — criar cobrança
  // ---------------------------------------------------------
  app.post('/payments', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() })
    }
    const data = parsed.data

    try {
      // Validar paciente existe
      const patient = await prisma.patient.findUnique({
        where: { id: data.patientId },
        select: { id: true },
      })
      if (!patient) return reply.code(404).send({ error: 'Paciente não encontrado' })

      // Se tiver appointmentId, validar consistência
      if (data.appointmentId) {
        const appointment = await prisma.appointment.findUnique({
          where: { id: data.appointmentId },
          select: { id: true, patientId: true, payment: { select: { id: true } } },
        })
        if (!appointment) {
          return reply.code(404).send({ error: 'Consulta não encontrada' })
        }
        if (appointment.patientId !== data.patientId) {
          return reply.code(400).send({
            error: 'A consulta informada não pertence a esse paciente',
          })
        }
        if (appointment.payment) {
          return reply.code(409).send({
            error: 'Já existe um pagamento associado a essa consulta',
          })
        }
      }

      // Coerência status x paidAt: se status=PAID e não veio paidAt, carimbar agora
      const finalStatus = data.status ?? 'PENDING'
      const finalPaidAt =
        finalStatus === 'PAID' ? (data.paidAt ?? new Date()) : (data.paidAt ?? null)

      const created = await prisma.payment.create({
        data: {
          patientId: data.patientId,
          appointmentId: data.appointmentId,
          amount: data.amount,
          method: data.method,
          status: finalStatus,
          dueDate: data.dueDate,
          paidAt: finalPaidAt,
          description: data.description,
          invoiceUrl: data.invoiceUrl,
        },
        include: paymentInclude,
      })
      const uid = (request.user as JwtPayload)?.sub ?? null
      logAudit({ userId: uid, action: 'CREATE_PAYMENT', entity: 'Payment', entityId: created.id, request })
      return reply.code(201).send(created)
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = extractUniqueViolationFields(err.meta)
        return reply.code(409).send({
          error: `Já existe um registro com esse(s) campo(s): ${target}`,
        })
      }
      request.log.error(err)
      return reply.code(500).send({ error: 'Erro interno ao criar pagamento' })
    }
  })

  // ---------------------------------------------------------
  // GET /payments/summary — totais agregados (dashboard)
  // ---------------------------------------------------------
  // IMPORTANTE: definida ANTES de /:id para não colidir.
  app.get('/payments/summary', async (request, reply) => {
    const parsed = summarySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() })
    }
    const { patientId, from, to, dateField } = parsed.data

    const where: Prisma.PaymentWhereInput = {
      ...(patientId ? { patientId } : {}),
      ...(from || to
        ? { [dateField]: { gte: from ?? undefined, lte: to ?? undefined } }
        : {}),
    }

    const [totalAgg, byStatus, byMethod] = await Promise.all([
      prisma.payment.aggregate({
        where,
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.payment.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.payment.groupBy({
        by: ['method'],
        where,
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ])

    const toNumber = (d: number | null) => d ?? 0

    return reply.send({
      period: { from: from ?? null, to: to ?? null, dateField },
      totals: {
        count: totalAgg._count._all,
        amount: toNumber(totalAgg._sum.amount),
      },
      byStatus: byStatus.map((r) => ({
        status: r.status,
        count: r._count._all,
        amount: toNumber(r._sum.amount),
      })),
      byMethod: byMethod.map((r) => ({
        method: r.method,
        count: r._count._all,
        amount: toNumber(r._sum.amount),
      })),
    })
  })

  // ---------------------------------------------------------
  // GET /payments — listagem com filtros + paginação
  // ---------------------------------------------------------
  app.get('/payments', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() })
    }
    const {
      patientId,
      appointmentId,
      status,
      method,
      from,
      to,
      dateField,
      overdueOnly,
      take,
      skip,
    } = parsed.data

    const where: Prisma.PaymentWhereInput = {
      ...(patientId ? { patientId } : {}),
      ...(appointmentId ? { appointmentId } : {}),
      ...(method ? { method } : {}),
      // Se overdueOnly, ignorar `status` da query e forçar PENDING + dueDate < agora
      ...(overdueOnly
        ? { status: 'PENDING', dueDate: { lt: new Date() } }
        : {
            ...(status ? { status } : {}),
            ...(from || to
              ? { [dateField]: { gte: from ?? undefined, lte: to ?? undefined } }
              : {}),
          }),
    }

    const [data, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        take,
        skip,
        orderBy: { [dateField]: 'desc' },
        include: paymentInclude,
      }),
      prisma.payment.count({ where }),
    ])

    return reply.send({ data, total, take, skip })
  })

  // ---------------------------------------------------------
  // GET /payments/:id — detalhe
  // ---------------------------------------------------------
  app.get('/payments/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() })
    }

    const found = await prisma.payment.findUnique({
      where: { id: parsed.data.id },
      include: paymentInclude,
    })

    if (!found) return reply.code(404).send({ error: 'Pagamento não encontrado' })
    return reply.send(found)
  })

  // ---------------------------------------------------------
  // PATCH /payments/:id — atualizar
  // ---------------------------------------------------------
  app.patch('/payments/:id', async (request, reply) => {
    const params = idParamSchema.safeParse(request.params)
    const body = updateSchema.safeParse(request.body)
    if (!params.success) return reply.code(400).send({ error: params.error.flatten() })
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    try {
      // Validar transição de status (se informada)
      if (body.data.status) {
        const current = await prisma.payment.findUnique({
          where: { id: params.data.id },
          select: { status: true },
        })
        if (!current) {
          return reply.code(404).send({ error: 'Pagamento não encontrado' })
        }
        if (!isValidTransition(current.status, body.data.status)) {
          return reply.code(422).send({
            error: `Transição de status inválida: ${current.status} → ${body.data.status}`,
            allowed: VALID_TRANSITIONS[current.status],
          })
        }
      }

      const dataToUpdate: Prisma.PaymentUpdateInput = {
        ...body.data,
      }

      const updated = await prisma.payment.update({
        where: { id: params.data.id },
        data: dataToUpdate,
        include: paymentInclude,
      })
      return reply.send(updated)
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2025') {
          return reply.code(404).send({ error: 'Pagamento não encontrado' })
        }
        if (err.code === 'P2002') {
          const target = extractUniqueViolationFields(err.meta)
          return reply.code(409).send({
            error: `Já existe um registro com esse(s) campo(s): ${target}`,
          })
        }
      }
      request.log.error(err)
      return reply.code(500).send({ error: 'Erro interno ao atualizar pagamento' })
    }
  })

  // ---------------------------------------------------------
  // POST /payments/:id/pay — atalho para marcar como PAID
  // ---------------------------------------------------------
  app.post('/payments/:id/pay', async (request, reply) => {
    const params = idParamSchema.safeParse(request.params)
    const body = paySchema.safeParse(request.body ?? {})
    if (!params.success) return reply.code(400).send({ error: params.error.flatten() })
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    try {
      const current = await prisma.payment.findUnique({
        where: { id: params.data.id },
        select: { status: true, method: true },
      })
      if (!current) return reply.code(404).send({ error: 'Pagamento não encontrado' })

      if (current.status === 'PAID') {
        return reply.code(409).send({ error: 'Pagamento já está pago' })
      }
      if (current.status === 'CANCELLED') {
        return reply.code(409).send({ error: 'Pagamento cancelado não pode ser pago' })
      }
      if (current.status === 'REFUNDED') {
        return reply.code(409).send({ error: 'Pagamento estornado não pode ser pago novamente' })
      }

      const paid = await prisma.payment.update({
        where: { id: params.data.id },
        data: {
          status: 'PAID',
          paidAt: body.data.paidAt ?? new Date(),
          // Se método veio no body, usa; senão mantém o atual
          ...(body.data.method ? { method: body.data.method } : {}),
        },
        include: paymentInclude,
      })
      const uid = (request.user as JwtPayload)?.sub ?? null
      logAudit({ userId: uid, action: 'PAY_PAYMENT', entity: 'Payment', entityId: paid.id, request })
      return reply.send(paid)
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return reply.code(404).send({ error: 'Pagamento não encontrado' })
      }
      request.log.error(err)
      return reply.code(500).send({ error: 'Erro interno ao registrar pagamento' })
    }
  })

  // ---------------------------------------------------------
  // POST /payments/:id/refund — estornar (só funciona em PAID)
  // ---------------------------------------------------------
  app.post('/payments/:id/refund', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    try {
      const current = await prisma.payment.findUnique({
        where: { id: parsed.data.id },
        select: { status: true },
      })
      if (!current) return reply.code(404).send({ error: 'Pagamento não encontrado' })

      if (current.status !== 'PAID') {
        return reply.code(409).send({
          error: `Apenas pagamentos PAID podem ser estornados. Status atual: ${current.status}`,
        })
      }

      const refunded = await prisma.payment.update({
        where: { id: parsed.data.id },
        data: { status: 'REFUNDED' },
        include: paymentInclude,
      })
      const uid = (request.user as JwtPayload)?.sub ?? null
      logAudit({ userId: uid, action: 'REFUND_PAYMENT', entity: 'Payment', entityId: refunded.id, request })
      return reply.send(refunded)
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return reply.code(404).send({ error: 'Pagamento não encontrado' })
      }
      request.log.error(err)
      return reply.code(500).send({ error: 'Erro interno ao estornar pagamento' })
    }
  })

  // ---------------------------------------------------------
  // DELETE /payments/:id — soft cancel (status: CANCELLED)
  // ---------------------------------------------------------
  app.delete('/payments/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    try {
      const current = await prisma.payment.findUnique({
        where: { id: parsed.data.id },
        select: { status: true },
      })
      if (!current) return reply.code(404).send({ error: 'Pagamento não encontrado' })

      if (current.status === 'CANCELLED') {
        return reply.code(409).send({ error: 'Pagamento já está cancelado' })
      }
      if (current.status === 'PAID') {
        return reply.code(409).send({
          error: 'Pagamento já realizado não pode ser cancelado. Use /refund para estornar.',
        })
      }
      if (current.status === 'REFUNDED') {
        return reply.code(409).send({ error: 'Pagamento estornado não pode ser cancelado' })
      }

      const cancelled = await prisma.payment.update({
        where: { id: parsed.data.id },
        data: { status: 'CANCELLED' },
        include: paymentInclude,
      })
      return reply.send(cancelled)
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return reply.code(404).send({ error: 'Pagamento não encontrado' })
      }
      request.log.error(err)
      return reply.code(500).send({ error: 'Erro interno ao cancelar pagamento' })
    }
  })
}