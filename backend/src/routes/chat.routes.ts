import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma2'
import { requireRole } from '../plugins/auth'

const listQuerySchema = z.object({
  search: z.string().optional(),
  take: z.coerce.number().int().positive().max(100).default(50),
  skip: z.coerce.number().int().nonnegative().default(0),
})

const transferSchema = z.object({
  doctorId: z.string(),
})

export async function chatRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requireRole('ADMIN', 'DOCTOR', 'RECEPTIONIST'))

  // ----- LISTAR CHATS -----
  app.get('/chats', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() })
    }

    const { search, take, skip } = parsed.data

    const where: any = {}
    if (search) {
      where.OR = [
        { phone: { contains: search } },
        { patient: { fullName: { contains: search } } },
      ]
    }

    const [chats, total] = await Promise.all([
      prisma.chat.findMany({
        where,
        include: {
          patient: { select: { id: true, fullName: true, cpf: true } },
          doctor: { select: { id: true, specialty: true, crm: true } },
        },
        orderBy: { lastMessageAt: 'desc' },
        take,
        skip,
      }),
      prisma.chat.count({ where }),
    ])

    return { data: chats, total, take, skip }
  })

  // ----- BUSCAR CHAT POR ID -----
  app.get('/chats/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const chat = await prisma.chat.findUnique({
      where: { id },
      include: {
        patient: true,
        doctor: true,
      },
    })

    if (!chat) {
      return reply.code(404).send({ error: 'Chat não encontrado' })
    }

    return { data: chat }
  })

  // ----- TRANSFERIR CHAT -----
  app.post('/chats/:id/transfer', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = transferSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() })
    }

    const { doctorId } = parsed.data

    // Verificar se o médico existe
    const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } })
    if (!doctor) {
      return reply.code(404).send({ error: 'Médico não encontrado' })
    }

    const chat = await prisma.chat.update({
      where: { id },
      data: {
        status: 'TRANSFERRED_TO_DOCTOR',
        transferredToDoctorId: doctorId,
      },
      include: {
        patient: { select: { id: true, fullName: true } },
        doctor: { select: { id: true, specialty: true, crm: true } },
      },
    })

    return { data: chat }
  })

  // ----- PAUSAR / RETOMAR IA -----
  app.post('/chats/:id/toggle-ai', async (request, reply) => {
    const { id } = request.params as { id: string }

    const chat = await prisma.chat.findUnique({ where: { id } })
    if (!chat) return reply.code(404).send({ error: 'Chat não encontrado' })

    const updated = await prisma.chat.update({
      where: { id },
      data: { aiPaused: !chat.aiPaused },
    })

    return { data: updated }
  })

  // ----- FECHAR CHAT -----
  app.post('/chats/:id/close', async (request, reply) => {
    const { id } = request.params as { id: string }

    const chat = await prisma.chat.update({
      where: { id },
      data: { status: 'CLOSED' },
    })

    return { data: chat }
  })

  // ----- MENSAGENS DO CHAT -----
  app.get('/chats/:id/messages', async (request, reply) => {
    const { id } = request.params as { id: string }

    const chat = await prisma.chat.findUnique({ where: { id } })
    if (!chat) return reply.code(404).send({ error: 'Chat não encontrado' })

    const messages = await prisma.chatLog.findMany({
      where: { phone: chat.phone },
      orderBy: { createdAt: 'asc' },
      take: 100,
    })

    return {
      data: messages.map(m => ({
        id: m.id,
        role: m.isUser ? 'user' : 'assistant',
        content: m.message,
        timestamp: m.createdAt,
      })),
    }
  })
}