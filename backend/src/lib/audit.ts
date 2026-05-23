import { prisma } from './prisma2'
import type { FastifyRequest } from 'fastify'

// Campos que NÃO devem aparecer em diffs (senhas, tokens)
const SENSITIVE_OMIT = new Set(['passwordHash', 'password', 'token', 'secret'])

interface AuditParams {
  userId:    string | null
  action:    string
  entity:    string
  entityId?: string | null
  metadata?: Record<string, unknown>
  before?:   Record<string, unknown>  // snapshot antes do update (LGPD)
  after?:    Record<string, unknown>  // snapshot depois do update (LGPD)
  request?:  FastifyRequest
}

/** Gera diff entre dois objetos, omitindo campos sensíveis */
function buildDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { before: unknown; after: unknown }> {
  const diff: Record<string, { before: unknown; after: unknown }> = {}
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const key of keys) {
    if (SENSITIVE_OMIT.has(key)) continue
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      diff[key] = { before: before[key] ?? null, after: after[key] ?? null }
    }
  }
  return diff
}

/**
 * Registra um evento de auditoria em background.
 * Fire-and-forget: erros aqui não devem derrubar a requisição principal.
 * Quando before+after são fornecidos, grava o diff dos campos alterados.
 */
export function logAudit(params: AuditParams): void {
  const { userId, action, entity, entityId, metadata, before, after, request } = params

  const ipAddress =
    (request?.headers?.['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
    request?.ip ??
    null

  const userAgent = (request?.headers?.['user-agent'] as string | undefined) ?? null

  const enrichedMeta: Record<string, unknown> = { ...metadata }
  if (before && after) {
    enrichedMeta.diff = buildDiff(before, after)
  }

  prisma.auditLog
    .create({
      data: {
        userId:    userId ?? null,
        action,
        entity,
        entityId:  entityId ?? null,
        metadata:  Object.keys(enrichedMeta).length > 0 ? (enrichedMeta as object) : undefined,
        ipAddress,
        userAgent,
      },
    })
    .catch((err) => {
      console.error('[audit] failed to write audit log:', err?.message ?? err)
    })
}
