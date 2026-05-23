import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma2'
import { logAudit } from '../lib/audit'
import { passwordSchema } from '../lib/password'
import { requireRole } from '../plugins/auth'
import type { JwtPayload } from '../plugins/auth'

// Blocklist em memória com TTL. Para multi-instância use Redis.
const revokedTokens = new Map<string, number>() // jti → expiry (unix ms)

setInterval(() => {
  const now = Date.now()
  for (const [jti, exp] of revokedTokens) {
    if (exp < now) revokedTokens.delete(jti)
  }
}, 5 * 60 * 1000)

export function isTokenRevoked(jti: string): boolean {
  return revokedTokens.has(jti)
}

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: passwordSchema,
  role: z.enum(['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'PATIENT']),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function authRoutes(app: FastifyInstance) {
  // 10 tentativas por 15 minutos por IP — proteção brute-force
  app.post('/auth/login', {
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
  }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() })
    }

    const { email, password } = parsed.data

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.isActive) {
      logAudit({ userId: null, action: 'LOGIN_FAILED', entity: 'User', metadata: { email }, request })
      return reply.code(401).send({ error: 'Credenciais invalidas' })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      logAudit({ userId: user.id, action: 'LOGIN_FAILED', entity: 'User', entityId: user.id, request })
      return reply.code(401).send({ error: 'Credenciais invalidas' })
    }

    const token = app.jwt.sign(
      { sub: user.id, role: user.role, name: user.name },
    )

    logAudit({ userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id, request })

    return reply.send({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  })

  // POST /auth/logout — revoga o token atual até expirar
  app.post('/auth/logout', { preHandler: requireRole('ADMIN', 'DOCTOR', 'RECEPTIONIST', 'PATIENT') },
    async (request, reply) => {
      const payload = request.user as JwtPayload
      const tokenKey = request.headers.authorization?.split(' ')[1] ?? payload.sub
      const exp = payload.exp ? payload.exp * 1000 : Date.now() + 8 * 60 * 60 * 1000
      revokedTokens.set(tokenKey, exp)
      const uid = payload.sub ?? null
      logAudit({ userId: uid, action: 'LOGOUT', entity: 'User', entityId: uid, request })
      return reply.send({ message: 'Sessão encerrada.' })
    },
  )

  app.post('/auth/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() })
    }

    const { name, email, password, role } = parsed.data

    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) {
      return reply.code(409).send({ error: 'E-mail ja cadastrado' })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: { name, email, passwordHash, role },
      select: { id: true, name: true, email: true, role: true },
    })

    return reply.code(201).send(user)
  })

}