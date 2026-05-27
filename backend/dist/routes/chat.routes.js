"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatRoutes = chatRoutes;
const zod_1 = require("zod");
const axios_1 = __importDefault(require("axios"));
const prisma2_1 = require("../lib/prisma2");
const auth_1 = require("../plugins/auth");
const listQuerySchema = zod_1.z.object({
    search: zod_1.z.string().optional(),
    take: zod_1.z.coerce.number().int().positive().max(100).default(50),
    skip: zod_1.z.coerce.number().int().nonnegative().default(0),
});
const transferSchema = zod_1.z.object({
    doctorId: zod_1.z.string(),
});
const sendMessageSchema = zod_1.z.object({
    message: zod_1.z.string().min(1),
});
// ─── Z-API helper ─────────────────────────────────────────────────────────────
async function sendZAPIMessage(phone, message) {
    const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE_ID;
    const ZAPI_TOKEN = process.env.ZAPI_TOKEN;
    const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;
    if (!ZAPI_INSTANCE || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN)
        return;
    const digits = phone.replace(/\D/g, '');
    const formattedPhone = digits.startsWith('55') ? digits : `55${digits}`;
    await axios_1.default.post(`https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`, { phone: formattedPhone, message }, { headers: { 'Client-Token': ZAPI_CLIENT_TOKEN, 'Content-Type': 'application/json' } });
}
// ─── Normaliza dígitos para comparação ────────────────────────────────────────
function digitsOnly(s) {
    return s.replace(/\D/g, '');
}
async function chatRoutes(app) {
    app.addHook('onRequest', (0, auth_1.requireRole)('ADMIN', 'DOCTOR', 'RECEPTIONIST'));
    // ----- LISTAR CHATS -----
    app.get('/chats', async (request, reply) => {
        const parsed = listQuerySchema.safeParse(request.query);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.flatten() });
        }
        const { search, take, skip } = parsed.data;
        const where = {};
        if (search) {
            where.OR = [
                { phone: { contains: search } },
                { patient: { fullName: { contains: search } } },
            ];
        }
        const [chats, total] = await Promise.all([
            prisma2_1.prisma.chat.findMany({
                where,
                include: {
                    patient: { select: { id: true, fullName: true, cpf: true } },
                    doctor: { select: { id: true, specialty: true, crm: true, user: { select: { name: true } } } },
                },
                orderBy: { lastMessageAt: 'desc' },
                take,
                skip,
            }),
            prisma2_1.prisma.chat.count({ where }),
        ]);
        // Resolve nomes de médicos pelo número de telefone (para chats sem paciente vinculado)
        const chatsWithoutPatient = chats.filter(c => !c.patientId);
        let doctorByPhone = new Map();
        if (chatsWithoutPatient.length > 0) {
            const allDoctors = await prisma2_1.prisma.doctor.findMany({
                where: { phone: { not: null } },
                select: { id: true, phone: true, specialty: true, user: { select: { name: true } } },
            });
            for (const d of allDoctors) {
                if (d.phone)
                    doctorByPhone.set(digitsOnly(d.phone), d);
            }
            // Auto-link pacientes ainda não vinculados
            for (const chat of chatsWithoutPatient) {
                const chatDigits = digitsOnly(chat.phone);
                const patient = await prisma2_1.prisma.patient.findFirst({
                    where: { phone: { contains: chatDigits } },
                    select: { id: true },
                });
                if (patient) {
                    await prisma2_1.prisma.chat.update({ where: { id: chat.id }, data: { patientId: patient.id } });
                    chat.patientId = patient.id;
                }
            }
        }
        // Compute scheduling status
        const phones = chats.map(c => c.phone);
        const [leads, preAppts] = phones.length > 0
            ? await Promise.all([
                prisma2_1.prisma.lead.findMany({ where: { phone: { in: phones } }, select: { id: true, phone: true, status: true } }),
                prisma2_1.prisma.preAppointment.findMany({
                    where: { leadId: { in: await prisma2_1.prisma.lead.findMany({ where: { phone: { in: phones } }, select: { id: true } }).then(ls => ls.map(l => l.id)) } },
                    select: { leadId: true, status: true },
                }),
            ])
            : [[], []];
        const leadsByPhone = new Map();
        for (const lead of leads) {
            const list = leadsByPhone.get(lead.phone) ?? [];
            list.push(lead);
            leadsByPhone.set(lead.phone, list);
        }
        const data = chats.map(chat => {
            const chatLeads = leadsByPhone.get(chat.phone) ?? [];
            let schedulingStatus = 'sem_agendamento';
            if (chatLeads.length > 0) {
                const leadIds = new Set(chatLeads.map(l => l.id));
                const chatPreAppts = preAppts.filter(p => leadIds.has(p.leadId));
                if (chatPreAppts.some(p => p.status === 'CONFIRMED' || p.status === 'PENDING')) {
                    schedulingStatus = 'agendado';
                }
                else if (chatPreAppts.some(p => p.status === 'CANCELLED')) {
                    schedulingStatus = 'cancelado';
                }
                else {
                    schedulingStatus = 'em_andamento';
                }
            }
            // Resolve nome de médico pelo telefone (quando não há paciente vinculado)
            const chatDigits = digitsOnly(chat.phone);
            const matchedDoctor = !chat.patientId ? doctorByPhone.get(chatDigits) : null;
            return {
                ...chat,
                schedulingStatus,
                resolvedDoctor: matchedDoctor ? { id: matchedDoctor.id, name: matchedDoctor.user?.name ?? null, specialty: matchedDoctor.specialty } : null,
            };
        });
        return { data, total, take, skip };
    });
    // ----- BUSCAR CHAT POR ID -----
    app.get('/chats/:id', async (request, reply) => {
        const { id } = request.params;
        const chat = await prisma2_1.prisma.chat.findUnique({
            where: { id },
            include: {
                patient: true,
                doctor: true,
            },
        });
        if (!chat) {
            return reply.code(404).send({ error: 'Chat não encontrado' });
        }
        return { data: chat };
    });
    // ----- TRANSFERIR CHAT (envia WhatsApp para médico aguardar confirmação) -----
    app.post('/chats/:id/transfer', async (request, reply) => {
        const { id } = request.params;
        const parsed = transferSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.flatten() });
        }
        const { doctorId } = parsed.data;
        const [doctor, chat] = await Promise.all([
            prisma2_1.prisma.doctor.findUnique({
                where: { id: doctorId },
                include: { user: { select: { name: true } } },
            }),
            prisma2_1.prisma.chat.findUnique({
                where: { id },
                include: { patient: { select: { fullName: true } } },
            }),
        ]);
        if (!doctor)
            return reply.code(404).send({ error: 'Médico não encontrado' });
        if (!chat)
            return reply.code(404).send({ error: 'Chat não encontrado' });
        const doctorName = doctor.user?.name ?? `CRM ${doctor.crm}`;
        const patientName = chat.patient?.fullName ?? chat.phone;
        // Marca como aguardando confirmação do médico (sem mudar status ainda)
        const updated = await prisma2_1.prisma.chat.update({
            where: { id },
            data: { pendingTransferDoctorId: doctorId },
            include: {
                patient: { select: { id: true, fullName: true } },
                doctor: { select: { id: true, specialty: true, crm: true } },
            },
        });
        // Envia WhatsApp para o médico (em background, não bloqueia a resposta)
        if (doctor.phone) {
            sendZAPIMessage(doctor.phone, `Olá, Dr(a). ${doctorName}! 👋\n\nTemos o paciente *${patientName}* aguardando atendimento em *${doctor.specialty}*.\n\nVocê tem disponibilidade para atendê-lo agora? Responda *SIM* para confirmar a transferência.`).catch(err => console.error('[transfer] Erro ao enviar WhatsApp para médico:', err));
        }
        return { data: updated, pending: true, message: doctor.phone ? `Mensagem enviada para o Dr(a). ${doctorName}. Aguardando confirmação.` : `Médico sem telefone cadastrado. Transferência imediata realizada.` };
    });
    // ----- CONFIRMAR TRANSFERÊNCIA DIRETA (sem aguardar resposta do médico) -----
    app.post('/chats/:id/transfer-confirm', async (request, reply) => {
        const { id } = request.params;
        const parsed = transferSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.flatten() });
        }
        const { doctorId } = parsed.data;
        const chat = await prisma2_1.prisma.chat.update({
            where: { id },
            data: { status: 'TRANSFERRED_TO_DOCTOR', transferredToDoctorId: doctorId, pendingTransferDoctorId: null },
            include: {
                patient: { select: { id: true, fullName: true } },
                doctor: { select: { id: true, specialty: true, crm: true } },
            },
        });
        return { data: chat };
    });
    // ----- PAUSAR / RETOMAR IA -----
    app.post('/chats/:id/toggle-ai', async (request, reply) => {
        const { id } = request.params;
        const chat = await prisma2_1.prisma.chat.findUnique({ where: { id } });
        if (!chat)
            return reply.code(404).send({ error: 'Chat não encontrado' });
        const updated = await prisma2_1.prisma.chat.update({
            where: { id },
            data: { aiPaused: !chat.aiPaused },
        });
        return { data: updated };
    });
    // ----- RETORNAR CHAT (desfazer transferência) -----
    app.post('/chats/:id/return', async (request, reply) => {
        const { id } = request.params;
        const chat = await prisma2_1.prisma.chat.update({
            where: { id },
            data: { status: 'ACTIVE', transferredToDoctorId: null, pendingTransferDoctorId: null },
        });
        return { data: chat };
    });
    // ----- ENVIAR MENSAGEM DIRETA (sem IA) — usado pelo atendente quando chat está pegado -----
    app.post('/chats/:id/send', async (request, reply) => {
        const { id } = request.params;
        const parsed = sendMessageSchema.safeParse(request.body);
        if (!parsed.success)
            return reply.code(400).send({ error: parsed.error.flatten() });
        const { message } = parsed.data;
        const chat = await prisma2_1.prisma.chat.findUnique({ where: { id } });
        if (!chat)
            return reply.code(404).send({ error: 'Chat não encontrado' });
        const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE_ID;
        const ZAPI_TOKEN = process.env.ZAPI_TOKEN;
        const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;
        if (!ZAPI_INSTANCE || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
            return reply.code(503).send({ error: 'WhatsApp não configurado.' });
        }
        const digits = chat.phone.replace(/\D/g, '');
        const formattedPhone = digits.startsWith('55') ? digits : `55${digits}`;
        try {
            await axios_1.default.post(`https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`, { phone: formattedPhone, message }, { headers: { 'Client-Token': ZAPI_CLIENT_TOKEN, 'Content-Type': 'application/json' } });
        }
        catch (err) {
            const axiosErr = err;
            const msg = axiosErr?.response?.data?.message ?? axiosErr?.message ?? 'Erro ao enviar via WhatsApp';
            return reply.code(502).send({ error: msg });
        }
        await prisma2_1.prisma.chatLog.create({
            data: { phone: chat.phone, message, isUser: false },
        });
        return { ok: true };
    });
    // ----- FECHAR CHAT -----
    app.post('/chats/:id/close', async (request, reply) => {
        const { id } = request.params;
        const chat = await prisma2_1.prisma.chat.update({
            where: { id },
            data: { status: 'CLOSED' },
        });
        return { data: chat };
    });
    // ----- MENSAGENS DO CHAT -----
    app.get('/chats/:id/messages', async (request, reply) => {
        const { id } = request.params;
        const chat = await prisma2_1.prisma.chat.findUnique({ where: { id } });
        if (!chat)
            return reply.code(404).send({ error: 'Chat não encontrado' });
        const messages = await prisma2_1.prisma.chatLog.findMany({
            where: { phone: chat.phone },
            orderBy: { createdAt: 'asc' },
            take: 100,
        });
        return {
            data: messages.map(m => ({
                id: m.id,
                role: m.isUser ? 'user' : 'assistant',
                content: m.message,
                timestamp: m.createdAt,
            })),
        };
    });
}
