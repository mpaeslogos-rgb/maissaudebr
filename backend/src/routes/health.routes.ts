import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';

export async function healthRoutes(app: FastifyInstance) {
  // Healthcheck simples (sem tocar no banco)
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Verifica conexão com o Postgres
  app.get('/db-check', async (request, reply) => {
    try {
      const result = await prisma.$queryRaw<{ now: Date }[]>`SELECT NOW() as now`;
      return {
        status: 'ok',
        database: 'connected',
        serverTime: result[0].now,
      };
    } catch (error: any) {
      reply.code(500);
      return {
        status: 'error',
        database: 'disconnected',
        message: error.message,
      };
    }
  });
}