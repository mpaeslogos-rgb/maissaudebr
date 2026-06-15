import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma2'
import { requireRole } from '../plugins/auth'

const requireAuth = requireRole('ADMIN', 'DOCTOR', 'RECEPTIONIST')

const enrollSchema = z.object({
  patientId:       z.string(),
  programId:       z.string(),
  startDate:       z.string(), // ISO date
  monthlyFee:      z.number().nonnegative().optional(),
  notes:           z.string().optional(),
})

export async function patientEnrollmentsRoutes(app: FastifyInstance) {
  // Listar matrículas (opcionalmente filtrar por paciente ou status)
  app.get('/patient-enrollments', { preHandler: [requireAuth] }, async (req, reply) => {
    const { patientId, status } = req.query as { patientId?: string; status?: string }
    const enrollments = await prisma.patientEnrollment.findMany({
      where: {
        ...(patientId ? { patientId } : {}),
        ...(status ? { status: status as any } : {}),
      },
      include: {
        patient: { select: { id: true, fullName: true, phone: true } },
        program: { select: { id: true, name: true, durationDays: true } },
        _count: { select: { payments: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(enrollments)
  })

  // Matricular paciente em um programa
  app.post('/patient-enrollments', { preHandler: [requireAuth] }, async (req, reply) => {
    const body = enrollSchema.parse(req.body)

    const program = await prisma.preventivoProgram.findUnique({ where: { id: body.programId } })
    if (!program) return reply.status(404).send({ error: 'Programa não encontrado' })

    const startDate = new Date(body.startDate)
    const monthlyFee = body.monthlyFee ?? program.monthlyFee

    // Data de término = start + durationDays
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + program.durationDays)

    // Próxima cobrança = 1 mês após o início
    const nextBillingDate = new Date(startDate)
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1)

    const enrollment = await prisma.$transaction(async (tx) => {
      const enroll = await tx.patientEnrollment.create({
        data: {
          patientId: body.patientId,
          programId: body.programId,
          startDate,
          endDate,
          monthlyFee,
          nextBillingDate,
          notes: body.notes,
        },
      })

      // Cria a primeira cobrança (taxa de entrada se houver + 1ª mensalidade)
      const totalFirstPayment = program.entryFee > 0
        ? program.entryFee + monthlyFee
        : monthlyFee

      await tx.payment.create({
        data: {
          patientId: body.patientId,
          enrollmentId: enroll.id,
          amount: totalFirstPayment,
          dueDate: startDate,
          description: program.entryFee > 0
            ? `${program.name} — Entrada + 1ª mensalidade`
            : `${program.name} — 1ª mensalidade`,
        },
      })

      return enroll
    })

    const full = await prisma.patientEnrollment.findUnique({
      where: { id: enrollment.id },
      include: {
        patient: { select: { id: true, fullName: true, phone: true } },
        program: true,
      },
    })
    return reply.status(201).send(full)
  })

  // Gerar próxima cobrança mensal manualmente
  app.post('/patient-enrollments/:id/bill', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const enrollment = await prisma.patientEnrollment.findUnique({
      where: { id },
      include: { program: true },
    })
    if (!enrollment) return reply.status(404).send({ error: 'Matrícula não encontrada' })
    if (enrollment.status !== 'ACTIVE') return reply.status(400).send({ error: 'Matrícula não está ativa' })

    const dueDate = new Date(enrollment.nextBillingDate)
    const nextBillingDate = new Date(dueDate)
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1)

    const [payment] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          patientId: enrollment.patientId,
          enrollmentId: enrollment.id,
          amount: enrollment.monthlyFee,
          dueDate,
          description: `${enrollment.program.name} — mensalidade`,
        },
      }),
      prisma.patientEnrollment.update({
        where: { id },
        data: { nextBillingDate },
      }),
    ])

    return reply.status(201).send(payment)
  })

  // Atualizar status / notas
  app.patch('/patient-enrollments/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const data = z.object({
      status:          z.enum(['ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED']).optional(),
      notes:           z.string().optional(),
      nextBillingDate: z.string().optional(),
    }).parse(req.body)

    const updated = await prisma.patientEnrollment.update({
      where: { id },
      data: {
        ...data,
        ...(data.nextBillingDate ? { nextBillingDate: new Date(data.nextBillingDate) } : {}),
      },
    })
    return reply.send(updated)
  })
}
