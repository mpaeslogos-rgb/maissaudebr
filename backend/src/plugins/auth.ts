import { FastifyRequest, FastifyReply } from 'fastify'

export type Role = 'ADMIN' | 'DOCTOR' | 'RECEPTIONIST' | 'PATIENT'

export interface JwtPayload {
  sub: string
  role: Role
  name: string
  jti?: string
  exp?: number
}

// Import lazy para evitar dependência circular (auth.routes importa auth.ts e vice-versa)
async function checkRevoked(jti: string | undefined, authorization: string | undefined): Promise<boolean> {
  if (!jti && !authorization) return false
  const { isTokenRevoked } = await import('../routes/auth.routes')
  const key = jti ?? authorization?.split(' ')[1] ?? ''
  return isTokenRevoked(key)
}

/** Apenas verifica se o JWT é válido — sem checar role. */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
    const payload = request.user as JwtPayload
    if (await checkRevoked(payload.jti, request.headers.authorization)) {
      return reply.code(401).send({ error: 'Token revogado. Faça login novamente.' })
    }
  } catch {
    reply.code(401).send({ error: 'Token inválido ou ausente' })
  }
}

/**
 * Verifica JWT e exige que o usuário tenha um dos roles informados.
 * Uso: app.addHook('preHandler', requireRole('ADMIN', 'DOCTOR'))
 */
export function requireRole(...roles: Role[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify()
    } catch {
      return reply.code(401).send({ error: 'Token inválido ou ausente' })
    }
    const payload = request.user as JwtPayload
    if (await checkRevoked(payload.jti, request.headers.authorization)) {
      return reply.code(401).send({ error: 'Token revogado. Faça login novamente.' })
    }
    if (!roles.includes(payload.role)) {
      return reply.code(403).send({ error: 'Acesso negado. Permissão insuficiente.' })
    }
  }
}

/** Extrai o payload JWT da request (já verificada). */
export function getPayload(request: FastifyRequest): JwtPayload {
  return request.user as JwtPayload
}

/** Extrai o payload JWT da request (já verificada). */
export function getPayload(request: FastifyRequest): JwtPayload {
  return request.user as JwtPayload
}
