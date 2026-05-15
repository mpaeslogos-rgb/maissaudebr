import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { requireRole } from '../plugins/auth'
import { prisma } from '../lib/prisma2'

const roleEnum = z.enum(['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'PATIENT'])

const listQuerySchema = z.object({
  q:       z.string().optional(),
  role:    roleEnum.optional(),
  active:  z.coerce.boolean().optional(),
  take:    z.coerce.number().int().positive().max(100).default(50),
  skip:    z.coerce.number().int().nonnegative().default(0),
})

const createSchema = z.object({
  email:    z.string().email(),
  name:     z.string().min(2).max(200),
  role:     roleEnum,
  password: z.string().min(6),
})

const updateSchema = z.object({
  name:     z.string().min(2).max(200).optional(),
  role:     roleEnum.optional(),
  isActive: z.boolean().optional(),
})

const resetPasswordSchema = z.object({
  password: z.string().min(6),
})

const SELECT_USER = {
  id:        true,
  email:     true,
  name:      true,
  role:      true,
  isActive:  true,
  createdAt: true,
  updatedAt: true,
} as const

export async function usersRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('ADMIN'))

  // GET /api/users
  app.get('/', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    const { q, role, active, take, skip } = parsed.data

    const where: Prisma.UserWhereInput = {
      ...(role   !== undefined ? { role }             : {}),
      ...(active !== undefined ? { isActive: active } : {}),
      ...(q
        ? { OR: [
            { name:  { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ]}
        : {}),
    }

    const [data, total] = await Promise.all([
      prisma.user.findMany({ where, select: SELECT_USER, orderBy: { name: 'asc' }, take, skip }),
      prisma.user.count({ where }),
    ])

    return reply.send({ data, total, take, skip })
  })

  // GET /api/users/:id
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const user = await prisma.user.findUnique({ where: { id }, select: SELECT_USER })
    if (!user) return reply.code(404).send({ error: 'Usuário não encontrado.' })
    return reply.send(user)
  })

  // POST /api/users
  app.post('/', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    const { email, name, role, password } = parsed.data
    const passwordHash = await bcrypt.hash(password, 10)

    try {
      const user = await prisma.user.create({
        data: { email, name, role, passwordHash },
        select: SELECT_USER,
      })
      return reply.code(201).send(user)
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return reply.code(409).send({ error: 'E-mail já cadastrado.' })
      }
      request.log.error(err)
      return reply.code(500).send({ error: 'Erro interno ao criar usuário.' })
    }
  })

  // PATCH /api/users/:id
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = updateSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    try {
      const user = await prisma.user.update({
        where: { id },
        data: parsed.data,
        select: SELECT_USER,
      })
      return reply.send(user)
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return reply.code(404).send({ error: 'Usuário não encontrado.' })
      }
      request.log.error(err)
      return reply.code(500).send({ error: 'Erro interno ao atualizar usuário.' })
    }
  })

  // POST /api/users/:id/reset-password
  app.post('/:id/reset-password', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = resetPasswordSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    const passwordHash = await bcrypt.hash(parsed.data.password, 10)

    try {
      await prisma.user.update({ where: { id }, data: { passwordHash } })
      return reply.send({ success: true })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return reply.code(404).send({ error: 'Usuário não encontrado.' })
      }
      request.log.error(err)
      return reply.code(500).send({ error: 'Erro interno ao redefinir senha.' })
    }
  })

  // DELETE /api/users/:id — desativa em vez de remover (soft delete)
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    try {
      await prisma.user.update({ where: { id }, data: { isActive: false } })
      return reply.code(204).send()
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return reply.code(404).send({ error: 'Usuário não encontrado.' })
      }
      request.log.error(err)
      return reply.code(500).send({ error: 'Erro interno ao desativar usuário.' })
    }
  })
}
