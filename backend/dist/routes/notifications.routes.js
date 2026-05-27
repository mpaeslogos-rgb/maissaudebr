"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationsRoutes = notificationsRoutes;
const auth_1 = require("../plugins/auth");
const reminder_job_1 = require("../jobs/reminder.job");
async function notificationsRoutes(app) {
    app.addHook('preHandler', (0, auth_1.requireRole)('ADMIN'));
    // POST /api/notifications/reminders/trigger?day=today|tomorrow
    // Disparo manual para testes — não espera o cron
    app.post('/reminders/trigger', async (request, reply) => {
        const { day } = request.query;
        const isToday = day === 'today';
        try {
            await (0, reminder_job_1.runReminders)(isToday);
            return reply.send({ success: true, message: `Lembretes ${isToday ? 'D-0' : 'D-1'} disparados.` });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : 'Erro desconhecido';
            return reply.code(500).send({ error: msg });
        }
    });
}
