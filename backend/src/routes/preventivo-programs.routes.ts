import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma2'
import { requireRole } from '../plugins/auth'

const requireAuth = requireRole('ADMIN', 'DOCTOR', 'RECEPTIONIST')

const programSchema = z.object({
  name:         z.string().min(1),
  description:  z.string().optional(),
  durationDays: z.number().int().positive(),
  monthlyFee:   z.number().nonnegative(),
  entryFee:     z.number().nonnegative().default(0),
  clinicScope:  z.string().optional(),
  isActive:     z.boolean().optional(),
})

export async function preventivoProgramsRoutes(app: FastifyInstance) {
  app.get('/preventivo-programs', { preHandler: [requireAuth] }, async (_req, reply) => {
    const programs = await prisma.preventivoProgram.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } },
      },
    })
    return reply.send(programs)
  })

  app.get('/preventivo-programs/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const program = await prisma.preventivoProgram.findUnique({
      where: { id },
      include: {
        enrollments: {
          include: { patient: { select: { id: true, fullName: true, phone: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    })
    if (!program) return reply.status(404).send({ error: 'Programa não encontrado' })
    return reply.send(program)
  })

  app.post('/preventivo-programs', { preHandler: [requireAuth] }, async (req, reply) => {
    const data = programSchema.parse(req.body)
    const program = await prisma.preventivoProgram.create({ data })
    return reply.status(201).send(program)
  })

  app.patch('/preventivo-programs/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const data = programSchema.partial().parse(req.body)
    const program = await prisma.preventivoProgram.update({ where: { id }, data })
    return reply.send(program)
  })

  app.delete('/preventivo-programs/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await prisma.preventivoProgram.update({ where: { id }, data: { isActive: false } })
    return reply.status(204).send()
  })
}
