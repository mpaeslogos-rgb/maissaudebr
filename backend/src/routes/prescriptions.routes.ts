import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma2'
import { requireRole } from '../plugins/auth'
import type { JwtPayload } from '../plugins/auth'
import { logAudit } from '../lib/audit'

const itemSchema = z.object({
  medication:   z.string().min(1, 'Medicamento obrigatório'),
  dosage:       z.string().min(1, 'Dose obrigatória'),
  frequency:    z.string().min(1, 'Frequência obrigatória'),
  duration:     z.string().optional(),
  instructions: z.string().optional(),
  order:        z.number().int().default(0),
})

const createSchema = z.object({
  doctorId:     z.string().min(1, 'Médico obrigatório'),
  appointmentId: z.string().optional(),
  validUntil:   z.string().optional().transform(v => (v ? new Date(v) : undefined)),
  notes:        z.string().optional(),
  items:        z.array(itemSchema).min(1, 'Adicione pelo menos um medicamento'),
})

const doctorInclude = {
  include: { user: { select: { name: true } } },
} as const

export async function prescriptionsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requireRole('ADMIN', 'DOCTOR', 'RECEPTIONIST'))

  // LIST by patient
  app.get('/patients/:patientId/prescriptions', async (request) => {
    const { patientId } = request.params as { patientId: string }
    const data = await prisma.prescription.findMany({
      where: { patientId },
      orderBy: { emittedAt: 'desc' },
      include: { items: { orderBy: { order: 'asc' } }, doctor: doctorInclude },
    })
    return { data }
  })

  // GET single
  app.get('/patients/:patientId/prescriptions/:id', async (request, reply) => {
    const { patientId, id } = request.params as { patientId: string; id: string }
    const p = await prisma.prescription.findFirst({
      where: { id, patientId },
      include: { items: { orderBy: { order: 'asc' } }, doctor: doctorInclude },
    })
    if (!p) return reply.code(404).send({ error: 'Prescrição não encontrada' })
    return p
  })

  // CREATE
  app.post('/patients/:patientId/prescriptions', async (request, reply) => {
    const { patientId } = request.params as { patientId: string }
    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    const { items, ...rest } = parsed.data
    const prescription = await prisma.prescription.create({
      data: {
        ...rest,
        patientId,
        items: {
          create: items.map((item, idx) => ({ ...item, order: item.order ?? idx })),
        },
      },
      include: { items: { orderBy: { order: 'asc' } }, doctor: doctorInclude },
    })

    const uid = (request.user as JwtPayload)?.sub ?? null
    logAudit({ userId: uid, action: 'CREATE', entity: 'Prescription', entityId: prescription.id, request })
    return reply.code(201).send(prescription)
  })

  // DELETE
  app.delete('/patients/:patientId/prescriptions/:id', async (request, reply) => {
    const { patientId, id } = request.params as { patientId: string; id: string }
    const existing = await prisma.prescription.findFirst({ where: { id, patientId }, select: { id: true } })
    if (!existing) return reply.code(404).send({ error: 'Prescrição não encontrada' })

    await prisma.prescription.delete({ where: { id } })
    const uid = (request.user as JwtPayload)?.sub ?? null
    logAudit({ userId: uid, action: 'DELETE', entity: 'Prescription', entityId: id, request })
    return { message: 'Prescrição removida' }
  })
}
