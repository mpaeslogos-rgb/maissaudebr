import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import axios from 'axios'
import { requireRole } from '../plugins/auth'
import { prisma } from '../lib/prisma2'

const sendSchema = z.object({
  to: z.string().min(8),
  message: z.string().min(1),
})

const bulkSendSchema = z.object({
  message: z.string().min(1).max(4096),
})

export async function whatsappRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('ADMIN', 'RECEPTIONIST'))

  // POST /api/whatsapp/send — envia mensagem via Z-API
  app.post('/send', async (request, reply) => {
    const parsed = sendSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    const { to, message } = parsed.data

    const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE_ID
    const ZAPI_TOKEN = process.env.ZAPI_TOKEN
    const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN

    if (!ZAPI_INSTANCE || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
      return reply.code(503).send({
        error: 'WhatsApp não configurado. Adicione ZAPI_INSTANCE_ID, ZAPI_TOKEN e ZAPI_CLIENT_TOKEN nas variáveis de ambiente do Railway.',
      })
    }

    // Normaliza número: remove não-dígitos, adiciona DDI 55 se necessário
    const digits = to.replace(/\D/g, '')
    const phone = digits.startsWith('55') ? digits : `55${digits}`

    try {
      const { data } = await axios.post(
        `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`,
        { phone, message },
        { headers: { 'Client-Token': ZAPI_CLIENT_TOKEN, 'Content-Type': 'application/json' } }
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

  // POST /api/whatsapp/bulk-send — envia mensagem para todos os pacientes com telefone
  app.post('/bulk-send', async (request, reply) => {
    const parsed = bulkSendSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    const { message } = parsed.data

    const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE_ID
    const ZAPI_TOKEN = process.env.ZAPI_TOKEN
    const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN

    if (!ZAPI_INSTANCE || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
      return reply.code(503).send({ error: 'WhatsApp não configurado.' })
    }

    const patients = await prisma.patient.findMany({
      where: { phone: { not: '' } },
      select: { id: true, fullName: true, phone: true },
      orderBy: { fullName: 'asc' },
    })

    let sent = 0
    let failed = 0
    const errors: { name: string; phone: string; reason: string }[] = []

    for (const patient of patients) {
      if (!patient.phone?.trim()) continue

      const digits = patient.phone.replace(/\D/g, '')
      if (digits.length < 10) { failed++; continue }
      const formattedPhone = digits.startsWith('55') ? digits : `55${digits}`

      try {
        await axios.post(
          `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`,
          { phone: formattedPhone, message },
          { headers: { 'Client-Token': ZAPI_CLIENT_TOKEN, 'Content-Type': 'application/json' } }
        )
        sent++
      } catch (err: unknown) {
        failed++
        const axiosErr = err as any
        errors.push({
          name: patient.fullName,
          phone: patient.phone,
          reason: axiosErr?.response?.data?.message ?? axiosErr?.message ?? 'Erro desconhecido',
        })
      }

      // Pausa entre envios para evitar bloqueio por rate-limit do WhatsApp
      await new Promise(resolve => setTimeout(resolve, 150))
    }

    return { sent, failed, total: patients.length, errors: errors.slice(0, 20) }
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
