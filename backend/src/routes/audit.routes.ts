import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireRole } from '../plugins/auth'
import { prisma } from '../lib/prisma2'
import type { JwtPayload } from '../plugins/auth'

const listQuerySchema = z.object({
  entity:   z.string().optional(),
  action:   z.string().optional(),
  userId:   z.string().optional(),
  search:   z.string().optional(),
  from:     z.coerce.date().optional(),
  to:       z.coerce.date().optional(),
  take:     z.coerce.number().int().positive().max(200).default(50),
  skip:     z.coerce.number().int().nonnegative().default(0),
})

export async function auditRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('ADMIN'))

  // GET /api/audit-logs
  app.get('/', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    const { entity, action, userId, search, from, to, take, skip } = parsed.data

    const where: any = {
      ...(entity ? { entity }           : {}),
      ...(action ? { action }           : {}),
      ...(userId ? { userId }           : {}),
      ...(from || to
        ? { createdAt: { gte: from ?? undefined, lte: to ?? undefined } }
        : {}),
      ...(search
        ? { OR: [
            { entity:   { contains: search, mode: 'insensitive' } },
            { action:   { contains: search, mode: 'insensitive' } },
            { entityId: { contains: search } },
          ]}
        : {}),
    }

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.auditLog.count({ where }),
    ])

    return reply.send({ data, total, take, skip })
  })

  // GET /api/audit-logs/summary — contagem por ação e entidade nos últimos 30 dias
  app.get('/summary', async (_request, reply) => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [byAction, byEntity, recentUsers] = await Promise.all([
      prisma.auditLog.groupBy({
        by: ['action'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        orderBy: { _count: { action: 'desc' } },
      }),
      prisma.auditLog.groupBy({
        by: ['entity'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        orderBy: { _count: { entity: 'desc' } },
      }),
      prisma.auditLog.findMany({
        where: { createdAt: { gte: since }, userId: { not: null } },
        select: {
          userId: true,
          user: { select: { name: true, email: true } },
          createdAt: true,
          action: true,
          entity: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        distinct: ['userId'],
      }),
    ])

    return reply.send({
      byAction:    byAction.map(r  => ({ action: r.action, count: r._count._all })),
      byEntity:    byEntity.map(r  => ({ entity: r.entity, count: r._count._all })),
      recentUsers: recentUsers.map(r => ({
        userId:    r.userId,
        name:      r.user?.name,
        email:     r.user?.email,
        lastAction: r.action,
        lastEntity: r.entity,
        at:         r.createdAt,
      })),
    })
  })

  // GET /api/audit-logs/:id
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const log = await prisma.auditLog.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    })

    if (!log) return reply.code(404).send({ error: 'Registro não encontrado.' })
    return reply.send(log)
  })
}
