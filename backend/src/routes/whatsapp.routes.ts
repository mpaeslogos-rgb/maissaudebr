import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import axios from 'axios'
import { requireRole } from '../plugins/auth'
import { prisma } from '../lib/prisma2'

const sendSchema = z.object({
  to: z.string().min(8),
  message: z.string().min(1),
})

export async function whatsappRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('ADMIN', 'RECEPTIONIST'))

  // POST /api/whatsapp/send — envia mensagem via Evolution API
  app.post('/send', async (request, reply) => {
    const parsed = sendSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    const { to, message } = parsed.data

    const EVOLUTION_URL = process.env.EVOLUTION_API_URL?.replace(/\/$/, '')
    const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY
    const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE

    if (!EVOLUTION_URL || !EVOLUTION_KEY || !EVOLUTION_INSTANCE) {
      return reply.code(503).send({
        error: 'WhatsApp não configurado. Adicione EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE nas variáveis de ambiente do Railway.',
      })
    }

    // Normaliza número: remove não-dígitos, adiciona DDI 55 se necessário
    const digits = to.replace(/\D/g, '')
    const phone = digits.startsWith('55') ? digits : `55${digits}`

    try {
      const { data } = await axios.post(
        `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
        { number: phone, text: message },
        { headers: { apikey: EVOLUTION_KEY, 'Content-Type': 'application/json' } }
      )
      return reply.send({ success: true, data })
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string; error?: string } }; message?: string }
      const msg =
        axiosErr?.response?.data?.message ??
        axiosErr?.response?.data?.error ??
        axiosErr?.message ??
        'Erro ao enviar mensagem via WhatsApp'
      return reply.code(502).send({ error: msg })
    }
  })

  // GET /api/whatsapp/contacts — lista unificada: pacientes + médicos + fornecedores
  app.get('/contacts', async (request, reply) => {
    const { search } = request.query as { search?: string }
    const q = search?.trim() || undefined

    const [patients, doctors, suppliers] = await Promise.all([
      prisma.patient.findMany({
        where: q
          ? { OR: [{ fullName: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] }
          : {},
        select: { id: true, fullName: true, phone: true, cpf: true },
        take: 100,
        orderBy: { fullName: 'asc' },
      }),

      prisma.doctor.findMany({
        where: {
          user: { isActive: true },
          ...(q
            ? { OR: [{ user: { name: { contains: q, mode: 'insensitive' } } }, { specialty: { contains: q, mode: 'insensitive' } }] }
            : {}),
        },
        select: { id: true, phone: true, specialty: true, crm: true, user: { select: { name: true } } },
        take: 50,
        orderBy: { createdAt: 'asc' },
      }),

      prisma.accountPayable.findMany({
        where: {
          supplier: { not: null },
          ...(q ? { supplier: { contains: q, mode: 'insensitive' } } : {}),
        },
        select: { id: true, supplier: true, supplierCnpj: true },
        distinct: ['supplier'],
        take: 50,
        orderBy: { supplier: 'asc' },
      }),
    ])

    const contacts = [
      ...patients.map(p => ({
        id: `patient_${p.id}`,
        name: p.fullName,
        phone: p.phone,
        detail: p.cpf,
        type: 'patient' as const,
      })),
      ...doctors.map(d => ({
        id: `doctor_${d.id}`,
        name: d.user?.name ?? `CRM ${d.crm}`,
        phone: d.phone ?? null,
        detail: d.specialty,
        type: 'doctor' as const,
      })),
      ...suppliers
        .filter(s => s.supplier)
        .map(s => ({
          id: `supplier_${s.id}`,
          name: s.supplier!,
          phone: null,
          detail: s.supplierCnpj ?? 'Fornecedor',
          type: 'supplier' as const,
        })),
    ]

    return reply.send({ data: contacts, total: contacts.length })
  })
}
