import { FastifyInstance } from 'fastify'
import { requireRole } from '../plugins/auth'
import { runReminders } from '../jobs/reminder.job'

export async function notificationsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('ADMIN'))

  // POST /api/notifications/reminders/trigger?day=today|tomorrow
  // Disparo manual para testes — não espera o cron
  app.post('/reminders/trigger', async (request, reply) => {
    const { day } = request.query as { day?: string }
    const isToday = day === 'today'

    try {
      await runReminders(isToday)
      return reply.send({ success: true, message: `Lembretes ${isToday ? 'D-0' : 'D-1'} disparados.` })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      return reply.code(500).send({ error: msg })
    }
  })
}
