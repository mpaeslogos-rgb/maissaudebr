import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma2';

export async function healthRoutes(app: FastifyInstance) {
  // Healthcheck simples (sem tocar no banco)
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Verifica a conexão com o banco de dados
  app.get('/db-check', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      return {
        status: 'ok',
        database: 'connected',
        serverTime: new Date().toISOString(),
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