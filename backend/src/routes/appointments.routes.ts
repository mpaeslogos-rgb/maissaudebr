import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Prisma, AppointmentStatus } from '@prisma/client'
import { requireRole } from '../plugins/auth'
import { prisma } from '../lib/prisma2'
import { extractUniqueViolationFields } from '../lib/prisma-errors'
import { logAudit } from '../lib/audit'
import type { JwtPayload } from '../plugins/auth'

// ============================================================
// SCHEMAS DE VALIDAÇÃO (Zod)
// ============================================================
// Schema usa: startTime, endTime (NÃO scheduledAt/duration!)
// IDs são CUIDs: z.string().min(1) (NUNCA .uuid())
// AppointmentStatus: SCHEDULED | CONFIRMED | IN_PROGRESS | COMPLETED | CANCELLED | NO_SHOW

const statusEnum = z.enum([
  'SCHEDULED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
])

const createSchema = z
  .object({
    patientId: z.string().min(1, 'patientId obrigatório'),
    doctorId: z.string().min(1, 'doctorId obrigatório'),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    reason: z.string().max(500).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((d) => d.startTime < d.endTime, {
    message: 'startTime deve ser anterior a endTime',
    path: ['endTime'],
  })
  .refine((d) => d.startTime.getTime() > Date.now(), {
    message: 'startTime deve estar no futuro',
    path: ['startTime'],
  })

const updateSchema = z
  .object({
    startTime: z.coerce.date().optional(),
    endTime: z.coerce.date().optional(),
    status: statusEnum.optional(),
    reason: z.string().max(500).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine(
    (d) => {
      if (d.startTime && d.endTime) return d.startTime < d.endTime
      return true
    },
    { message: 'startTime deve ser anterior a endTime', path: ['endTime'] },
  )

const idParamSchema = z.object({ id: z.string().min(1, 'ID inválido') })

const listQuerySchema = z.object({
  doctorId: z.string().min(1).optional(),
  patientId: z.string().min(1).optional(),
  status: statusEnum.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  take: z.coerce.number().int().positive().max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
})

// ============================================================
// MÁQUINA DE ESTADOS (transições válidas)
// ============================================================
// Por que? Sem isso, alguém poderia voltar uma consulta de COMPLETED para SCHEDULED.
const VALID_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  SCHEDULED:   ['CONFIRMED', 'CANCELLED', 'NO_SHOW'],
  CONFIRMED:   ['IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED:   [], // estado terminal
  CANCELLED:   [], // estado terminal
  NO_SHOW:     [], // estado terminal
}

function isValidTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  if (from === to) return true // idempotente
  return VALID_TRANSITIONS[from].includes(to)
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Detecta sobreposição de horário do mesmo médico.
 * Regra de overlap clássica: [A_start, A_end) intersecta [B_start, B_end)
 * sse  A_start < B_end  AND  A_end > B_start.
 *
 * Por que findFirst? Só precisamos saber SE existe — não precisamos da lista.
 * Por que notIn CANCELLED/NO_SHOW? Consultas canceladas liberam o horário.
 */
async function hasScheduleConflict(
  doctorId: string,
  start: Date,
  end: Date,
  excludeId?: string,
): Promise<boolean> {
  const conflict = await prisma.appointment.findFirst({
    where: {
      doctorId,
      id: excludeId ? { not: excludeId } : undefined,
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      startTime: { lt: end },
      endTime: { gt: start },
    },
    select: { id: true },
  })
  return conflict !== null
}

// Include padrão para respostas (sem vazar passwordHash, endereço completo, etc.)
const appointmentInclude = {
  patient: {
    select: { id: true, fullName: true, cpf: true, phone: true, email: true },
  },
  doctor: {
    select: {
      id: true,
      crm: true,
      crmState: true,
      specialty: true,
      user: { select: { id: true, name: true, email: true } },
    },
  },
} satisfies Prisma.AppointmentInclude

// ============================================================
// ROTAS
// ============================================================
export async function appointmentsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('ADMIN', 'DOCTOR', 'RECEPTIONIST'))

  // ---------------------------------------------------------
  // POST /appointments — agendar consulta
  // ---------------------------------------------------------
  app.post('/appointments', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() })
    }
    const { patientId, doctorId, startTime, endTime, reason, notes } = parsed.data

    try {
      // Valida existência ANTES de tentar inserir (mensagens mais claras que P2003)
      const [patient, doctor] = await Promise.all([
        prisma.patient.findUnique({ where: { id: patientId }, select: { id: true } }),
        prisma.doctor.findUnique({ where: { id: doctorId }, select: { id: true } }),
      ])
      if (!patient) return reply.code(404).send({ error: 'Paciente não encontrado' })
      if (!doctor) return reply.code(404).send({ error: 'Médico não encontrado' })

      if (await hasScheduleConflict(doctorId, startTime, endTime)) {
        return reply.code(409).send({
          error: 'Conflito de horário: o médico já tem uma consulta nesse intervalo',
        })
      }

      const created = await prisma.appointment.create({
        data: { patientId, doctorId, startTime, endTime, reason, notes },
        include: appointmentInclude,
      })
      const uid = (request.user as JwtPayload)?.sub ?? null
      logAudit({ userId: uid, action: 'CREATE', entity: 'Appointment', entityId: created.id, request })
      return reply.code(201).send(created)
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = extractUniqueViolationFields(err.meta)
        return reply.code(409).send({
          error: `Já existe um registro com esse(s) campo(s): ${target}`,
        })
      }
      request.log.error(err)
      return reply.code(500).send({ error: 'Erro interno ao criar consulta' })
    }
  })

  // ---------------------------------------------------------
  // GET /appointments — listagem com filtros + paginação
  // ---------------------------------------------------------
  app.get('/appointments', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() })
    }
    const { doctorId, patientId, status, from, to, take, skip } = parsed.data

    const where: Prisma.AppointmentWhereInput = {
      doctorId,
      patientId,
      status,
      // Filtra consultas cujo startTime cai no intervalo [from, to]
      ...(from || to
        ? { startTime: { gte: from ?? undefined, lte: to ?? undefined } }
        : {}),
    }

    const [data, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        take,
        skip,
        orderBy: { startTime: 'asc' },
        include: appointmentInclude,
      }),
      prisma.appointment.count({ where }),
    ])

    return reply.send({ data, total, take, skip })
  })

  // ---------------------------------------------------------
  // GET /appointments/:id — detalhe completo
  // ---------------------------------------------------------
  app.get('/appointments/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() })
    }

    const found = await prisma.appointment.findUnique({
      where: { id: parsed.data.id },
      include: {
        ...appointmentInclude,
        medicalRecord: true,
        payment: true,
      },
    })

    if (!found) return reply.code(404).send({ error: 'Consulta não encontrada' })
    return reply.send(found)
  })

  // ---------------------------------------------------------
  // PATCH /appointments/:id — re-agendar / mudar status / notas
  // ---------------------------------------------------------
  app.patch('/appointments/:id', async (request, reply) => {
    const params = idParamSchema.safeParse(request.params)
    const body = updateSchema.safeParse(request.body)
    if (!params.success) return reply.code(400).send({ error: params.error.flatten() })
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    try {
      const current = await prisma.appointment.findUnique({
        where: { id: params.data.id },
        select: { id: true, doctorId: true, startTime: true, endTime: true, status: true },
      })
      if (!current) return reply.code(404).send({ error: 'Consulta não encontrada' })

      // Validação de transição de status
      if (body.data.status && !isValidTransition(current.status, body.data.status)) {
        return reply.code(422).send({
          error: `Transição de status inválida: ${current.status} → ${body.data.status}`,
          allowed: VALID_TRANSITIONS[current.status],
        })
      }

      // Re-validação de conflito se horário mudou
      if (body.data.startTime || body.data.endTime) {
        const newStart = body.data.startTime ?? current.startTime
        const newEnd = body.data.endTime ?? current.endTime
        if (newStart >= newEnd) {
          return reply.code(400).send({ error: 'startTime deve ser anterior a endTime' })
        }
        if (await hasScheduleConflict(current.doctorId, newStart, newEnd, current.id)) {
          return reply.code(409).send({
            error: 'Conflito de horário: o médico já tem uma consulta nesse intervalo',
          })
        }
      }

      const updated = await prisma.appointment.update({
        where: { id: params.data.id },
        data: body.data,
        include: appointmentInclude,
      })
      const uid = (request.user as JwtPayload)?.sub ?? null
      const action = body.data.status ? `STATUS_${body.data.status}` : 'UPDATE'
      logAudit({ userId: uid, action, entity: 'Appointment', entityId: updated.id, request })
      return reply.send(updated)
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2025') {
          return reply.code(404).send({ error: 'Consulta não encontrada' })
        }
        if (err.code === 'P2002') {
          const target = extractUniqueViolationFields(err.meta)
          return reply.code(409).send({
            error: `Já existe um registro com esse(s) campo(s): ${target}`,
          })
        }
      }
      request.log.error(err)
      return reply.code(500).send({ error: 'Erro interno ao atualizar consulta' })
    }
  })

  // ---------------------------------------------------------
  // DELETE /appointments/:id — soft cancel (status: CANCELLED)
  // ---------------------------------------------------------
  // Por que não delete real? Histórico clínico/financeiro precisa ser auditável.
  app.delete('/appointments/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    try {
      const current = await prisma.appointment.findUnique({
        where: { id: parsed.data.id },
        select: { status: true },
      })
      if (!current) return reply.code(404).send({ error: 'Consulta não encontrada' })

      if (current.status === 'CANCELLED') {
        return reply.code(409).send({ error: 'Consulta já está cancelada' })
      }
      if (current.status === 'COMPLETED') {
        return reply.code(409).send({ error: 'Consulta concluída não pode ser cancelada' })
      }

      const cancelled = await prisma.appointment.update({
        where: { id: parsed.data.id },
        data: { status: 'CANCELLED' },
        include: appointmentInclude,
      })
      const uid = (request.user as JwtPayload)?.sub ?? null
      logAudit({ userId: uid, action: 'CANCEL', entity: 'Appointment', entityId: cancelled.id, request })
      return reply.send(cancelled)
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return reply.code(404).send({ error: 'Consulta não encontrada' })
      }
      request.log.error(err)
      return reply.code(500).send({ error: 'Erro interno ao cancelar consulta' })
    }
  })
}