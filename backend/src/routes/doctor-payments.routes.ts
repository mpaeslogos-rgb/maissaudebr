import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole, getPayload } from '../plugins/auth'
import type { JwtPayload } from '../plugins/auth'
import { prisma } from '../lib/prisma2'
import { logAudit } from '../lib/audit'

const idParam = z.object({ id: z.string().min(1) })

const listQuerySchema = z.object({
  doctorId: z.string().optional(),
  status:   z.enum(['PENDING', 'PAID', 'CANCELLED']).optional(),
  from:     z.string().optional(),
  to:       z.string().optional(),
  take:     z.coerce.number().int().positive().max(200).default(50),
  skip:     z.coerce.number().int().min(0).default(0),
})

const markPaidSchema = z.object({
  ids:   z.array(z.string().min(1)).min(1),
  notes: z.string().optional(),
})

export async function doctorPaymentsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('ADMIN', 'RECEPTIONIST'))

  // GET /doctor-payments — lista repasses com filtros
  app.get('/doctor-payments', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    const { doctorId, status, from, to, take, skip } = parsed.data

    const where: Prisma.DoctorPaymentWhereInput = {
      ...(doctorId && { doctorId }),
      ...(status   && { status }),
      ...(from || to ? {
        createdAt: {
          ...(from && { gte: new Date(from) }),
          ...(to   && { lte: new Date(to + 'T23:59:59') }),
        },
      } : {}),
    }

    const [data, total] = await Promise.all([
      prisma.doctorPayment.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          doctor: {
            select: {
              id: true, crm: true, crmState: true, specialty: true, repasseType: true, repasseValue: true,
              user: { select: { name: true, email: true } },
            },
          },
          appointment: {
            select: {
              id: true, startTime: true, endTime: true, status: true,
              patient: { select: { id: true, fullName: true } },
            },
          },
          payment: { select: { id: true, amount: true, status: true, paidAt: true } },
        },
      }),
      prisma.doctorPayment.count({ where }),
    ])

    return reply.send({ data, total, take, skip })
  })

  // GET /doctor-payments/summary — totais por médico
  app.get('/doctor-payments/summary', async (_request, reply) => {
    const rows = await prisma.doctorPayment.groupBy({
      by: ['doctorId', 'status'],
      _sum:   { amount: true },
      _count: { id: true },
    })

    const doctors = await prisma.doctor.findMany({
      select: {
        id: true, specialty: true, repasseType: true, repasseValue: true,
        user: { select: { name: true } },
      },
    })

    const doctorMap = Object.fromEntries(doctors.map(d => [d.id, d]))

    const summary: Record<string, unknown>[] = []
    const grouped: Record<string, Record<string, { amount: number; count: number }>> = {}

    for (const row of rows) {
      if (!grouped[row.doctorId]) grouped[row.doctorId] = {}
      grouped[row.doctorId][row.status] = {
        amount: row._sum.amount ?? 0,
        count:  row._count.id,
      }
    }

    for (const [doctorId, byStatus] of Object.entries(grouped)) {
      summary.push({
        doctor:  doctorMap[doctorId],
        pending: byStatus['PENDING']  ?? { amount: 0, count: 0 },
        paid:    byStatus['PAID']     ?? { amount: 0, count: 0 },
      })
    }

    return reply.send({ data: summary })
  })

  // POST /doctor-payments/mark-paid — marca repasses como pagos em lote
  app.post('/doctor-payments/mark-paid', async (request, reply) => {
    const parsed = markPaidSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    const { ids, notes } = parsed.data
    const now = new Date()

    const updated = await prisma.doctorPayment.updateMany({
      where: { id: { in: ids }, status: 'PENDING' },
      data:  { status: 'PAID', paidAt: now, notes: notes ?? null },
    })

    const uid = (request.user as JwtPayload)?.sub ?? null
    logAudit({ userId: uid, action: 'MARK_PAID_DOCTOR_PAYMENTS', entity: 'DoctorPayment', metadata: { ids, count: updated.count }, request })

    return reply.send({ updated: updated.count })
  })

  // PATCH /doctor-payments/:id/cancel — cancela repasse individual
  app.patch('/doctor-payments/:id/cancel', async (request, reply) => {
    const params = idParam.safeParse(request.params)
    if (!params.success) return reply.code(400).send({ error: params.error.flatten() })

    try {
      const dp = await prisma.doctorPayment.update({
        where: { id: params.data.id },
        data:  { status: 'CANCELLED' },
      })
      const uid = (request.user as JwtPayload)?.sub ?? null
      logAudit({ userId: uid, action: 'CANCEL_DOCTOR_PAYMENT', entity: 'DoctorPayment', entityId: dp.id, request })
      return reply.send(dp)
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025')
        return reply.code(404).send({ error: 'Repasse não encontrado' })
      throw err
    }
  })
}

// ─── Função auxiliar: cria repasse automático após pagamento confirmado ────────
// Chamada dentro de payments.routes ao marcar status → PAID
export async function createDoctorPaymentIfNeeded(paymentId: string): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      appointment: {
        include: {
          doctor: { select: { id: true, repasseType: true, repasseValue: true } },
        },
      },
    },
  })

  if (!payment?.appointment) return
  const { appointment } = payment
  const doctor = appointment.doctor

  // Já existe repasse para essa consulta?
  const exists = await prisma.doctorPayment.findUnique({ where: { appointmentId: appointment.id } })
  if (exists) return

  // Calcula valor do repasse
  if (!doctor.repasseValue) return

  const consultaValue = payment.amount
  const repasseAmount =
    doctor.repasseType === 'PERCENTAGE'
      ? (consultaValue * doctor.repasseValue) / 100
      : doctor.repasseValue

  await prisma.doctorPayment.create({
    data: {
      doctorId:      doctor.id,
      appointmentId: appointment.id,
      paymentId:     payment.id,
      amount:        repasseAmount,
      status:        'PENDING',
    },
  })
}
