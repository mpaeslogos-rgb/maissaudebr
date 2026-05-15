import { prisma } from './prisma2'
import type { FastifyRequest } from 'fastify'

interface AuditParams {
  userId:    string | null
  action:    string
  entity:    string
  entityId?: string | null
  metadata?: Record<string, unknown>
  request?:  FastifyRequest
}

/**
 * Registra um evento de auditoria em background.
 * Fire-and-forget: erros aqui não devem derrubar a requisição principal.
 */
export function logAudit(params: AuditParams): void {
  const { userId, action, entity, entityId, metadata, request } = params

  const ipAddress =
    (request?.headers?.['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
    request?.ip ??
    null

  const userAgent = (request?.headers?.['user-agent'] as string | undefined) ?? null

  prisma.auditLog
    .create({
      data: {
        userId:    userId ?? null,
        action,
        entity,
        entityId:  entityId ?? null,
        metadata:  metadata ? (metadata as object) : undefined,
        ipAddress,
        userAgent,
      },
    })
    .catch((err) => {
      console.error('[audit] failed to write audit log:', err?.message ?? err)
    })
}
