"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRoutes = healthRoutes;
const prisma2_1 = require("../lib/prisma2");
async function healthRoutes(app) {
    // Healthcheck simples (sem tocar no banco)
    app.get('/health', async () => {
        return { status: 'ok', timestamp: new Date().toISOString() };
    });
    // Verifica a conexão com o banco de dados
    app.get('/db-check', async (_request, reply) => {
        try {
            await prisma2_1.prisma.$queryRaw `SELECT 1`;
            return {
                status: 'ok',
                database: 'connected',
                serverTime: new Date().toISOString(),
            };
        }
        catch (error) {
            reply.code(500);
            return {
                status: 'error',
                database: 'disconnected',
                message: error.message,
            };
        }
    });
}
