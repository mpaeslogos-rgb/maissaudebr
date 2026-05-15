import { FastifyRequest, FastifyReply } from 'fastify'

export type Role = 'ADMIN' | 'DOCTOR' | 'RECEPTIONIST' | 'PATIENT'

export interface JwtPayload {
  sub: string
  role: Role
  name: string
}

/** Apenas verifica se o JWT é válido — sem checar role. */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
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
    if (!roles.includes(payload.role)) {
      return reply.code(403).send({ error: 'Acesso negado. Permissão insuficiente.' })
    }
  }
}

/** Extrai o payload JWT da request (já verificada). */
export function getPayload(request: FastifyRequest): JwtPayload {
  return request.user as JwtPayload
}
