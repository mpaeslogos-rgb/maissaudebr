"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.npsRoutes = npsRoutes;
const zod_1 = require("zod");
const prisma2_1 = require("../lib/prisma2");
const auth_1 = require("../plugins/auth");
const requireAuth = (0, auth_1.requireRole)('ADMIN', 'DOCTOR', 'RECEPTIONIST');
async function sendZapiText(phone, message) {
    const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE_ID;
    const ZAPI_TOKEN = process.env.ZAPI_TOKEN;
    const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;
    if (!ZAPI_INSTANCE || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN)
        return false;
    try {
        const res = await fetch(`https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Client-Token': ZAPI_CLIENT_TOKEN },
            body: JSON.stringify({ phone, message }),
        });
        return res.ok;
    }
    catch {
        return false;
    }
}
async function npsRoutes(app) {
    // Listar respostas NPS (com filtros opcionais)
    app.get('/nps', { preHandler: [requireAuth] }, async (req, reply) => {
        const { patientId, from, to } = req.query;
        const responses = await prisma2_1.prisma.npsResponse.findMany({
            where: {
                ...(patientId ? { patientId } : {}),
                ...(from || to ? {
                    createdAt: {
                        ...(from ? { gte: new Date(from) } : {}),
                        ...(to ? { lte: new Date(to) } : {}),
                    },
                } : {}),
            },
            include: {
                patient: { select: { id: true, fullName: true, phone: true } },
                appointment: { select: { id: true, startTime: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        return reply.send(responses);
    });
    // Resumo NPS — score médio, distribuição detratores/neutros/promotores
    app.get('/nps/summary', { preHandler: [requireAuth] }, async (req, reply) => {
        const { from, to } = req.query;
        const responses = await prisma2_1.prisma.npsResponse.findMany({
            where: {
                respondedAt: { not: null },
                ...(from || to ? {
                    respondedAt: {
                        ...(from ? { gte: new Date(from) } : {}),
                        ...(to ? { lte: new Date(to) } : {}),
                    },
                } : {}),
            },
            select: { score: true },
        });
        const total = responses.length;
        if (total === 0)
            return reply.send({ total: 0, nps: null, promoters: 0, neutrals: 0, detractors: 0, avgScore: null });
        const promoters = responses.filter(r => r.score >= 9).length;
        const neutrals = responses.filter(r => r.score >= 7 && r.score <= 8).length;
        const detractors = responses.filter(r => r.score <= 6).length;
        const avgScore = responses.reduce((s, r) => s + r.score, 0) / total;
        const nps = Math.round(((promoters - detractors) / total) * 100);
        return reply.send({ total, nps, promoters, neutrals, detractors, avgScore: +avgScore.toFixed(1) });
    });
    // Enviar NPS via WhatsApp após consulta concluída
    app.post('/nps/send', { preHandler: [requireAuth] }, async (req, reply) => {
        const { appointmentId } = zod_1.z.object({ appointmentId: zod_1.z.string() }).parse(req.body);
        const appt = await prisma2_1.prisma.appointment.findUnique({
            where: { id: appointmentId },
            include: { patient: true },
        });
        if (!appt)
            return reply.status(404).send({ error: 'Consulta não encontrada' });
        if (appt.status !== 'COMPLETED')
            return reply.status(400).send({ error: 'Consulta não concluída' });
        // Evitar reenvio
        const existing = await prisma2_1.prisma.npsResponse.findUnique({ where: { appointmentId } });
        if (existing)
            return reply.status(409).send({ error: 'NPS já enviado para esta consulta' });
        const clinicName = process.env.NEXT_PUBLIC_CLINIC_NAME ?? 'nossa clínica';
        const message = `Olá, ${appt.patient.fullName.split(' ')[0]}! 😊\n` +
            `Obrigado por consultar conosco na ${clinicName}.\n\n` +
            `Em uma escala de *0 a 10*, o quanto você nos recomendaria para um amigo ou familiar?\n` +
            `Responda apenas com o número (ex: 9)`;
        const sent = await sendZapiText(appt.patient.phone, message);
        const npsRecord = await prisma2_1.prisma.npsResponse.create({
            data: {
                patientId: appt.patientId,
                appointmentId,
                score: 0, // será atualizado quando o paciente responder
                sentAt: sent ? new Date() : null,
            },
        });
        return reply.status(201).send({ ...npsRecord, sent });
    });
    // Registrar resposta do paciente (via webhook ou manualmente)
    app.patch('/nps/:id/respond', { preHandler: [requireAuth] }, async (req, reply) => {
        const { id } = req.params;
        const { score, comment } = zod_1.z.object({
            score: zod_1.z.number().int().min(0).max(10),
            comment: zod_1.z.string().optional(),
        }).parse(req.body);
        const updated = await prisma2_1.prisma.npsResponse.update({
            where: { id },
            data: { score, comment, respondedAt: new Date() },
        });
        return reply.send(updated);
    });
    // Registrar NPS manualmente (sem envio WhatsApp)
    app.post('/nps', { preHandler: [requireAuth] }, async (req, reply) => {
        const data = zod_1.z.object({
            patientId: zod_1.z.string(),
            appointmentId: zod_1.z.string().optional(),
            score: zod_1.z.number().int().min(0).max(10),
            comment: zod_1.z.string().optional(),
        }).parse(req.body);
        const record = await prisma2_1.prisma.npsResponse.create({
            data: { ...data, respondedAt: new Date() },
        });
        return reply.status(201).send(record);
    });
}
