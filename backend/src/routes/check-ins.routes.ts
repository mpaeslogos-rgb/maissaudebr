import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma2'
import { requireRole } from '../plugins/auth'

const requireAuth = requireRole('ADMIN', 'DOCTOR', 'RECEPTIONIST')

const checkInSchema = z.object({
  patientId:    z.string(),
  enrollmentId: z.string(),
  scheduledAt:  z.string(),
  type:         z.enum(['INITIAL_ASSESSMENT', 'MONTHLY_REVIEW', 'METABOLIC_REVIEW', 'LAB_RESULTS', 'FOLLOWUP']).optional(),
  notes:        z.string().optional(),
})

export async function checkInsRoutes(app: FastifyInstance) {
  // Listar check-ins (filtrar por enrollmentId ou patientId)
  app.get('/check-ins', { preHandler: [requireAuth] }, async (req, reply) => {
    const { enrollmentId, patientId, pending } = req.query as {
      enrollmentId?: string
      patientId?: string
      pending?: string
    }
    const checkIns = await prisma.checkIn.findMany({
      where: {
        ...(enrollmentId ? { enrollmentId } : {}),
        ...(patientId ? { patientId } : {}),
        ...(pending === 'true' ? { completedAt: null } : {}),
      },
      include: {
        patient:    { select: { id: true, fullName: true } },
        enrollment: { include: { program: { select: { id: true, name: true } } } },
      },
      orderBy: { scheduledAt: 'asc' },
    })
    return reply.send(checkIns)
  })

  // Criar check-in
  app.post('/check-ins', { preHandler: [requireAuth] }, async (req, reply) => {
    const body = checkInSchema.parse(req.body)
    const checkIn = await prisma.checkIn.create({
      data: {
        patientId:    body.patientId,
        enrollmentId: body.enrollmentId,
        scheduledAt:  new Date(body.scheduledAt),
        type:         body.type ?? 'MONTHLY_REVIEW',
        notes:        body.notes,
      },
      include: {
        patient:    { select: { id: true, fullName: true } },
        enrollment: { include: { program: { select: { id: true, name: true } } } },
      },
    })
    return reply.status(201).send(checkIn)
  })

  // Completar ou editar check-in
  app.patch('/check-ins/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const data = z.object({
      completedAt: z.string().nullable().optional(),
      notes:       z.string().optional(),
      scheduledAt: z.string().optional(),
      type:        z.enum(['INITIAL_ASSESSMENT', 'MONTHLY_REVIEW', 'METABOLIC_REVIEW', 'LAB_RESULTS', 'FOLLOWUP']).optional(),
    }).parse(req.body)

    const updated = await prisma.checkIn.update({
      where: { id },
      data: {
        ...(data.completedAt !== undefined ? { completedAt: data.completedAt ? new Date(data.completedAt) : null } : {}),
        ...(data.notes       !== undefined ? { notes: data.notes } : {}),
        ...(data.scheduledAt !== undefined ? { scheduledAt: new Date(data.scheduledAt) } : {}),
        ...(data.type        !== undefined ? { type: data.type } : {}),
      },
    })
    return reply.send(updated)
  })

  // Deletar check-in
  app.delete('/check-ins/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await prisma.checkIn.delete({ where: { id } })
    return reply.status(204).send()
  })

  // KPI: adesão aos check-ins de uma matrícula
  app.get('/check-ins/adhesion/:enrollmentId', { preHandler: [requireAuth] }, async (req, reply) => {
    const { enrollmentId } = req.params as { enrollmentId: string }
    const all       = await prisma.checkIn.count({ where: { enrollmentId } })
    const completed = await prisma.checkIn.count({ where: { enrollmentId, completedAt: { not: null } } })
    const pending   = all - completed
    const adhesion  = all > 0 ? Math.round((completed / all) * 100) : null
    return reply.send({ total: all, completed, pending, adhesionPct: adhesion })
  })
}
