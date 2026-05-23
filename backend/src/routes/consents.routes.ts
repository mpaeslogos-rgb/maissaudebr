import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireRole } from '../plugins/auth'
import type { JwtPayload } from '../plugins/auth'
import { prisma } from '../lib/prisma2'
import { logAudit } from '../lib/audit'

const VALID_PURPOSES = [
  'tratamento_clinico',
  'comunicacao_whatsapp',
  'comunicacao_email',
  'marketing',
  'compartilhamento_parceiros',
  'pesquisa_anonima',
] as const

const grantSchema = z.object({
  purpose:   z.enum(VALID_PURPOSES),
  notes:     z.string().max(500).optional(),
})

const revokeSchema = z.object({
  purpose: z.enum(VALID_PURPOSES),
})

export async function consentsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('ADMIN', 'DOCTOR', 'RECEPTIONIST'))

  // GET /patients/:id/consents — lista todos os consentimentos do paciente
  app.get('/patients/:id/consents', async (request, reply) => {
    const { id } = request.params as { id: string }

    const patient = await prisma.patient.findUnique({ where: { id }, select: { id: true } })
    if (!patient) return reply.code(404).send({ error: 'Paciente não encontrado' })

    const consents = await prisma.consent.findMany({
      where: { patientId: id },
      orderBy: { grantedAt: 'desc' },
    })

    return reply.send(consents)
  })

  // POST /patients/:id/consents — registrar consentimento
  app.post('/patients/:id/consents', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = grantSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    const patient = await prisma.patient.findUnique({ where: { id }, select: { id: true } })
    if (!patient) return reply.code(404).send({ error: 'Paciente não encontrado' })

    const ipAddress = (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? request.ip
    const userAgent = request.headers['user-agent'] ?? null

    // Upsert: se já existe consent para essa finalidade, atualiza
    const existing = await prisma.consent.findFirst({
      where: { patientId: id, purpose: parsed.data.purpose },
      orderBy: { grantedAt: 'desc' },
    })

    if (existing?.granted) {
      return reply.code(409).send({ error: 'Consentimento já ativo para essa finalidade' })
    }

    const consent = await prisma.consent.create({
      data: {
        patientId: id,
        purpose:   parsed.data.purpose,
        granted:   true,
        ipAddress,
        userAgent,
        notes:     parsed.data.notes,
      },
    })

    const uid = (request.user as JwtPayload)?.sub ?? null
    logAudit({ userId: uid, action: 'CONSENT_GRANTED', entity: 'Consent', entityId: consent.id,
      metadata: { patientId: id, purpose: parsed.data.purpose }, request })

    return reply.code(201).send(consent)
  })

  // DELETE /patients/:id/consents/:purpose — revogar consentimento
  app.delete('/patients/:id/consents/:purpose', async (request, reply) => {
    const { id, purpose } = request.params as { id: string; purpose: string }

    if (!VALID_PURPOSES.includes(purpose as (typeof VALID_PURPOSES)[number])) {
      return reply.code(400).send({ error: 'Finalidade inválida' })
    }

    const active = await prisma.consent.findFirst({
      where: { patientId: id, purpose, granted: true },
      orderBy: { grantedAt: 'desc' },
    })

    if (!active) return reply.code(404).send({ error: 'Nenhum consentimento ativo para essa finalidade' })

    const revoked = await prisma.consent.update({
      where: { id: active.id },
      data: { granted: false, revokedAt: new Date() },
    })

    const uid = (request.user as JwtPayload)?.sub ?? null
    logAudit({ userId: uid, action: 'CONSENT_REVOKED', entity: 'Consent', entityId: revoked.id,
      metadata: { patientId: id, purpose }, request })

    return reply.send(revoked)
  })
}
