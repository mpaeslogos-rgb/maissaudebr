"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappRoutes = whatsappRoutes;
const zod_1 = require("zod");
const axios_1 = __importDefault(require("axios"));
const auth_1 = require("../plugins/auth");
const prisma2_1 = require("../lib/prisma2");
const sendSchema = zod_1.z.object({
    to: zod_1.z.string().min(8),
    message: zod_1.z.string().min(1),
});
const bulkSendSchema = zod_1.z.object({
    message: zod_1.z.string().min(1).max(4096),
});
async function whatsappRoutes(app) {
    app.addHook('preHandler', (0, auth_1.requireRole)('ADMIN', 'RECEPTIONIST'));
    // POST /api/whatsapp/send — envia mensagem via Z-API
    app.post('/send', async (request, reply) => {
        const parsed = sendSchema.safeParse(request.body);
        if (!parsed.success)
            return reply.code(400).send({ error: parsed.error.flatten() });
        const { to, message } = parsed.data;
        const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE_ID;
        const ZAPI_TOKEN = process.env.ZAPI_TOKEN;
        const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;
        if (!ZAPI_INSTANCE || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
            return reply.code(503).send({
                error: 'WhatsApp não configurado. Adicione ZAPI_INSTANCE_ID, ZAPI_TOKEN e ZAPI_CLIENT_TOKEN nas variáveis de ambiente do Railway.',
            });
        }
        // Normaliza número: remove não-dígitos, adiciona DDI 55 se necessário
        const digits = to.replace(/\D/g, '');
        const phone = digits.startsWith('55') ? digits : `55${digits}`;
        try {
            const { data } = await axios_1.default.post(`https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`, { phone, message }, { headers: { 'Client-Token': ZAPI_CLIENT_TOKEN, 'Content-Type': 'application/json' } });
            return reply.send({ success: true, data });
        }
        catch (err) {
            const axiosErr = err;
            const msg = axiosErr?.response?.data?.message ??
                axiosErr?.response?.data?.error ??
                axiosErr?.message ??
                'Erro ao enviar mensagem via WhatsApp';
            return reply.code(502).send({ error: msg });
        }
    });
    // POST /api/whatsapp/bulk-send — envia mensagem para todos os pacientes com telefone
    app.post('/bulk-send', async (request, reply) => {
        const parsed = bulkSendSchema.safeParse(request.body);
        if (!parsed.success)
            return reply.code(400).send({ error: parsed.error.flatten() });
        const { message } = parsed.data;
        const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE_ID;
        const ZAPI_TOKEN = process.env.ZAPI_TOKEN;
        const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;
        if (!ZAPI_INSTANCE || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
            return reply.code(503).send({ error: 'WhatsApp não configurado.' });
        }
        const patients = await prisma2_1.prisma.patient.findMany({
            where: { phone: { not: '' } },
            select: { id: true, fullName: true, phone: true },
            orderBy: { fullName: 'asc' },
        });
        let sent = 0;
        let failed = 0;
        const errors = [];
        for (const patient of patients) {
            if (!patient.phone?.trim())
                continue;
            const digits = patient.phone.replace(/\D/g, '');
            if (digits.length < 10) {
                failed++;
                continue;
            }
            const formattedPhone = digits.startsWith('55') ? digits : `55${digits}`;
            try {
                await axios_1.default.post(`https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`, { phone: formattedPhone, message }, { headers: { 'Client-Token': ZAPI_CLIENT_TOKEN, 'Content-Type': 'application/json' } });
                sent++;
            }
            catch (err) {
                failed++;
                const axiosErr = err;
                errors.push({
                    name: patient.fullName,
                    phone: patient.phone,
                    reason: axiosErr?.response?.data?.message ?? axiosErr?.message ?? 'Erro desconhecido',
                });
            }
            // Pausa entre envios para evitar bloqueio por rate-limit do WhatsApp
            await new Promise(resolve => setTimeout(resolve, 150));
        }
        return { sent, failed, total: patients.length, errors: errors.slice(0, 20) };
    });
    // GET /api/whatsapp/contacts — lista unificada: pacientes + médicos + fornecedores
    app.get('/contacts', async (request, reply) => {
        const { search } = request.query;
        const q = search?.trim() || undefined;
        const [patients, doctors, suppliers] = await Promise.all([
            prisma2_1.prisma.patient.findMany({
                where: q
                    ? { OR: [{ fullName: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] }
                    : {},
                select: { id: true, fullName: true, phone: true, cpf: true },
                take: 100,
                orderBy: { fullName: 'asc' },
            }),
            prisma2_1.prisma.doctor.findMany({
                where: {
                    user: { isActive: true },
                    ...(q
                        ? { OR: [{ user: { name: { contains: q, mode: 'insensitive' } } }, { specialty: { contains: q, mode: 'insensitive' } }] }
                        : {}),
                },
                select: { id: true, phone: true, specialty: true, crm: true, user: { select: { name: true } } },
                take: 50,
                orderBy: { createdAt: 'asc' },
            }),
            prisma2_1.prisma.accountPayable.findMany({
                where: {
                    supplier: { not: null },
                    ...(q ? { supplier: { contains: q, mode: 'insensitive' } } : {}),
                },
                select: { id: true, supplier: true, supplierCnpj: true },
                distinct: ['supplier'],
                take: 50,
                orderBy: { supplier: 'asc' },
            }),
        ]);
        const contacts = [
            ...patients.map(p => ({
                id: `patient_${p.id}`,
                name: p.fullName,
                phone: p.phone,
                detail: p.cpf,
                type: 'patient',
            })),
            ...doctors.map(d => ({
                id: `doctor_${d.id}`,
                name: d.user?.name ?? `CRM ${d.crm}`,
                phone: d.phone ?? null,
                detail: d.specialty,
                type: 'doctor',
            })),
            ...suppliers
                .filter(s => s.supplier)
                .map(s => ({
                id: `supplier_${s.id}`,
                name: s.supplier,
                phone: null,
                detail: s.supplierCnpj ?? 'Fornecedor',
                type: 'supplier',
            })),
        ];
        return reply.send({ data: contacts, total: contacts.length });
    });
}
