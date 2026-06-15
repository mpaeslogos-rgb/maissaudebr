import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma2'
import { requireRole } from '../plugins/auth'

const requireAuth = requireRole('ADMIN', 'DOCTOR', 'RECEPTIONIST')

const markerSchema = z.object({
  patientId:     z.string(),
  date:          z.string(), // ISO date
  weight:        z.number().positive().optional(),
  bmi:           z.number().positive().optional(),
  systolicBP:    z.number().positive().optional(),
  diastolicBP:   z.number().positive().optional(),
  glucose:       z.number().positive().optional(),
  hba1c:         z.number().positive().optional(),
  totalChol:     z.number().positive().optional(),
  ldl:           z.number().positive().optional(),
  hdl:           z.number().positive().optional(),
  triglycerides: z.number().positive().optional(),
  notes:         z.string().optional(),
})

export async function metabolicMarkersRoutes(app: FastifyInstance) {
  // Listar marcadores de um paciente
  app.get('/metabolic-markers', { preHandler: [requireAuth] }, async (req, reply) => {
    const { patientId } = req.query as { patientId: string }
    if (!patientId) return reply.status(400).send({ error: 'patientId obrigatório' })

    const markers = await prisma.metabolicMarker.findMany({
      where: { patientId },
      orderBy: { date: 'asc' },
    })
    return reply.send(markers)
  })

  // Criar registro de marcadores
  app.post('/metabolic-markers', { preHandler: [requireAuth] }, async (req, reply) => {
    const data = markerSchema.parse(req.body)
    const marker = await prisma.metabolicMarker.create({
      data: { ...data, date: new Date(data.date) },
    })
    return reply.status(201).send(marker)
  })

  // Atualizar
  app.patch('/metabolic-markers/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const data = markerSchema.partial().omit({ patientId: true }).parse(req.body)
    const marker = await prisma.metabolicMarker.update({
      where: { id },
      data: {
        ...data,
        ...(data.date ? { date: new Date(data.date) } : {}),
      },
    })
    return reply.send(marker)
  })

  // Deletar
  app.delete('/metabolic-markers/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await prisma.metabolicMarker.delete({ where: { id } })
    return reply.status(204).send()
  })
}
