import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { requireRole, getPayload } from '../plugins/auth'
import type { JwtPayload } from '../plugins/auth'
import { prisma } from '../lib/prisma2'
import { extractUniqueViolationFields } from '../lib/prisma-errors'
import { logAudit } from '../lib/audit'

// ============================================================
// SCHEMAS DE VALIDAÇÃO (Zod)
// ============================================================
// IMPORTANTE: User usa `name`, Patient usa `fullName`
// IDs no Prisma 7 são CUIDs (não UUIDs)
const createDoctorSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  crm: z.string().min(3),
  crmState: z.string().length(2),
  cpf: z.string().optional(),
  specialty: z.string().min(2),
  consultationFee: z.number().positive().optional(),
  phone: z.string().optional(),
  bio: z.string().optional(),
  workStartHour: z.number().int().min(0).max(23).default(8),
  workEndHour: z.number().int().min(1).max(24).default(18),
})

const updateDoctorSchema = z.object({
  specialty:       z.string().min(2).optional(),
  cpf:             z.string().nullable().optional(),
  consultationFee: z.number().positive().nullable().optional(),
  phone:           z.string().nullable().optional(),
  bio:             z.string().nullable().optional(),
  crmState:        z.string().length(2).optional(),
  workStartHour:   z.number().int().min(0).max(23).optional(),
  workEndHour:     z.number().int().min(1).max(24).optional(),
  repasseType:     z.enum(['PERCENTAGE', 'FIXED']).optional(),
  repasseValue:    z.number().min(0).nullable().optional(),
})

const idParamSchema = z.object({ id: z.string().min(1, 'ID inválido') })

const listQuerySchema = z.object({
  q: z.string().optional(),
  take: z.coerce.number().int().positive().max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
})

// ============================================================
// ROTAS
// ============================================================
export async function doctorsRoutes(app: FastifyInstance) {
  // Todos podem listar/ver médicos; só ADMIN pode criar/editar/excluir
  app.addHook('preHandler', requireRole('ADMIN', 'DOCTOR', 'RECEPTIONIST'))

  // POST /doctors — cria User + Doctor em transação atômica
  app.post('/doctors', { preHandler: requireRole('ADMIN') }, async (request, reply) => {
    const parsed = createDoctorSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() })
    }

    const { name, email, password, crm, crmState, specialty, consultationFee, phone, bio, workStartHour, workEndHour } =
      parsed.data

    try {
      const passwordHash = await bcrypt.hash(password, 10)

      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { name, email, passwordHash, role: 'DOCTOR' },
        })

        const doctor = await tx.doctor.create({
          data: {
            userId: user.id,
            crm,
            crmState: crmState.toUpperCase(),
            specialty,
            consultationFee,
            phone,
            bio,
            workStartHour,
            workEndHour,
          },
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true, isActive: true },
            },
          },
        })

        return doctor
      })

      const uid = (request.user as JwtPayload)?.sub ?? null
      logAudit({ userId: uid, action: 'CREATE_DOCTOR', entity: 'Doctor', entityId: result.id, request })
      return reply.code(201).send(result)
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = extractUniqueViolationFields(err.meta)
        return reply.code(409).send({
          error: `Já existe um registro com esse(s) campo(s): ${target}`,
        })
      }
      request.log.error(err)
      return reply.code(500).send({ error: 'Erro interno ao criar médico' })
    }
  })

  // GET /doctors/me — perfil do médico logado
  app.get('/doctors/me', async (request, reply) => {
    const payload = getPayload(request)
    if (payload.role !== 'DOCTOR') return reply.code(403).send({ error: 'Apenas médicos podem acessar este recurso' })
    const doctor = await prisma.doctor.findUnique({
      where: { userId: payload.sub },
      include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
    })
    if (!doctor) return reply.code(404).send({ error: 'Perfil de médico não encontrado' })
    return reply.send(doctor)
  })

  // PATCH /doctors/me/signature-provider — médico configura seu provedor preferido
  app.patch('/doctors/me/signature-provider', async (request, reply) => {
    const payload = getPayload(request)
    if (payload.role !== 'DOCTOR') return reply.code(403).send({ error: 'Apenas médicos podem acessar este recurso' })
    const parsed = z.object({ signatureProvider: z.enum(['MOCK', 'VIDAAS', 'BIRDID']) }).safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    const doctor = await prisma.doctor.findUnique({ where: { userId: payload.sub } })
    if (!doctor) return reply.code(404).send({ error: 'Médico não encontrado' })

    const updated = await prisma.doctor.update({
      where: { id: doctor.id },
      data: { signatureProvider: parsed.data.signatureProvider as any },
    })
    return reply.send({ signatureProvider: updated.signatureProvider })
  })

  // GET /doctors — listagem com paginação e busca
  app.get('/doctors', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() })
    }
    const { q, take, skip } = parsed.data

    const where: Prisma.DoctorWhereInput = q
      ? {
          OR: [
            { crm: { contains: q } },
            { specialty: { contains: q } },
            { user: { name: { contains: q } } },
          ],
        }
      : {}

    const [data, total] = await Promise.all([
      prisma.doctor.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true, isActive: true } },
        },
      }),
      prisma.doctor.count({ where }),
    ])

    return reply.send({ data, total, take, skip })
  })

  // GET /doctors/:id — detalhe + appointments recentes
  app.get('/doctors/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() })
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id: parsed.data.id },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true, isActive: true },
        },
        appointments: {
          take: 10,
          orderBy: { startTime: 'desc' },
          include: {
            patient: { select: { id: true, fullName: true, cpf: true } },
          },
        },
      },
    })

    if (!doctor) return reply.code(404).send({ error: 'Médico não encontrado' })
    return reply.send(doctor)
  })

  // PATCH /doctors/:id
  app.patch('/doctors/:id', { preHandler: requireRole('ADMIN') }, async (request, reply) => {
    const params = idParamSchema.safeParse(request.params)
    const body = updateDoctorSchema.safeParse(request.body)
    if (!params.success) return reply.code(400).send({ error: params.error.flatten() })
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    try {
      const d = body.data
      const updateData: Prisma.DoctorUpdateInput = {}
      if (d.specialty        !== undefined) updateData.specialty       = d.specialty
      if (d.crmState        !== undefined) updateData.crmState        = d.crmState.toUpperCase()
      if (d.cpf             !== undefined) updateData.cpf             = d.cpf
      if (d.phone           !== undefined) updateData.phone           = d.phone
      if (d.bio             !== undefined) updateData.bio             = d.bio
      if (d.consultationFee !== undefined) updateData.consultationFee = d.consultationFee
      if (d.workStartHour   !== undefined) updateData.workStartHour   = d.workStartHour
      if (d.workEndHour     !== undefined) updateData.workEndHour     = d.workEndHour
      if (d.repasseType     !== undefined) updateData.repasseType     = d.repasseType
      if (d.repasseValue    !== undefined) updateData.repasseValue    = d.repasseValue
      const updated = await prisma.doctor.update({
        where: { id: params.data.id },
        data:  updateData,
        include: {
          user: { select: { id: true, name: true, email: true, isActive: true } },
        },
      })
      const uid = (request.user as JwtPayload)?.sub ?? null
      logAudit({ userId: uid, action: 'UPDATE_DOCTOR', entity: 'Doctor', entityId: updated.id, request })
      return reply.send(updated)
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2025') {
          return reply.code(404).send({ error: 'Médico não encontrado' })
        }
        if (err.code === 'P2002') {
          const target = extractUniqueViolationFields(err.meta)
          return reply.code(409).send({
            error: `Já existe um registro com esse(s) campo(s): ${target}`,
          })
        }
      }
      request.log.error(err)
      return reply.code(500).send({ error: 'Erro interno ao atualizar médico' })
    }
  })

  // DELETE /doctors/:id — soft delete (desativa o User)
  app.delete('/doctors/:id', { preHandler: requireRole('ADMIN') }, async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() })
    }

    try {
      const doctor = await prisma.doctor.findUnique({
        where: { id: parsed.data.id },
        select: { userId: true },
      })
      if (!doctor) return reply.code(404).send({ error: 'Médico não encontrado' })

      await prisma.user.update({
        where: { id: doctor.userId },
        data: { isActive: false },
      })

      const uid = (request.user as JwtPayload)?.sub ?? null
      logAudit({ userId: uid, action: 'DEACTIVATE_DOCTOR', entity: 'Doctor', entityId: parsed.data.id, request })
      return reply.code(204).send()
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return reply.code(404).send({ error: 'Médico não encontrado' })
      }
      request.log.error(err)
      return reply.code(500).send({ error: 'Erro interno ao remover médico' })
    }
  })
}