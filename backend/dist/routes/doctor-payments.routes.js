"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.doctorPaymentsRoutes = doctorPaymentsRoutes;
exports.createDoctorPaymentIfNeeded = createDoctorPaymentIfNeeded;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const auth_1 = require("../plugins/auth");
const prisma2_1 = require("../lib/prisma2");
const audit_1 = require("../lib/audit");
const idParam = zod_1.z.object({ id: zod_1.z.string().min(1) });
const listQuerySchema = zod_1.z.object({
    doctorId: zod_1.z.string().optional(),
    status: zod_1.z.enum(['PENDING', 'PAID', 'CANCELLED']).optional(),
    from: zod_1.z.string().optional(),
    to: zod_1.z.string().optional(),
    take: zod_1.z.coerce.number().int().positive().max(200).default(50),
    skip: zod_1.z.coerce.number().int().min(0).default(0),
});
const markPaidSchema = zod_1.z.object({
    payments: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string().min(1),
        nfNumber: zod_1.z.string().min(1, 'Número da NF/Recibo é obrigatório'),
    })).min(1),
    notes: zod_1.z.string().optional(),
});
async function doctorPaymentsRoutes(app) {
    app.addHook('preHandler', (0, auth_1.requireRole)('ADMIN', 'RECEPTIONIST'));
    // GET /doctor-payments — lista repasses com filtros
    app.get('/doctor-payments', async (request, reply) => {
        const parsed = listQuerySchema.safeParse(request.query);
        if (!parsed.success)
            return reply.code(400).send({ error: parsed.error.flatten() });
        const { doctorId, status, from, to, take, skip } = parsed.data;
        const where = {
            ...(doctorId && { doctorId }),
            ...(status && { status }),
            ...(from || to ? {
                createdAt: {
                    ...(from && { gte: new Date(from) }),
                    ...(to && { lte: new Date(to + 'T23:59:59') }),
                },
            } : {}),
        };
        const [data, total] = await Promise.all([
            prisma2_1.prisma.doctorPayment.findMany({
                where,
                take,
                skip,
                orderBy: { createdAt: 'desc' },
                include: {
                    doctor: {
                        select: {
                            id: true, crm: true, crmState: true, specialty: true, repasseType: true, repasseValue: true,
                            user: { select: { name: true, email: true } },
                        },
                    },
                    appointment: {
                        select: {
                            id: true, startTime: true, endTime: true, status: true,
                            patient: { select: { id: true, fullName: true } },
                        },
                    },
                    payment: { select: { id: true, amount: true, status: true, paidAt: true } },
                },
            }),
            prisma2_1.prisma.doctorPayment.count({ where }),
        ]);
        return reply.send({ data, total, take, skip });
    });
    // GET /doctor-payments/summary — totais por médico
    app.get('/doctor-payments/summary', async (_request, reply) => {
        const rows = await prisma2_1.prisma.doctorPayment.groupBy({
            by: ['doctorId', 'status'],
            _sum: { amount: true },
            _count: { id: true },
        });
        const doctors = await prisma2_1.prisma.doctor.findMany({
            select: {
                id: true, specialty: true, repasseType: true, repasseValue: true,
                user: { select: { name: true } },
            },
        });
        const doctorMap = Object.fromEntries(doctors.map(d => [d.id, d]));
        const summary = [];
        const grouped = {};
        for (const row of rows) {
            if (!grouped[row.doctorId])
                grouped[row.doctorId] = {};
            grouped[row.doctorId][row.status] = {
                amount: row._sum.amount ?? 0,
                count: row._count.id,
            };
        }
        for (const [doctorId, byStatus] of Object.entries(grouped)) {
            summary.push({
                doctor: doctorMap[doctorId],
                pending: byStatus['PENDING'] ?? { amount: 0, count: 0 },
                paid: byStatus['PAID'] ?? { amount: 0, count: 0 },
            });
        }
        return reply.send({ data: summary });
    });
    // POST /doctor-payments/mark-paid — marca repasses como pagos em lote
    // Cada item deve ter nfNumber (NF ou recibo do médico)
    app.post('/doctor-payments/mark-paid', async (request, reply) => {
        const parsed = markPaidSchema.safeParse(request.body);
        if (!parsed.success)
            return reply.code(400).send({ error: parsed.error.flatten() });
        const { payments: items, notes } = parsed.data;
        const now = new Date();
        const ids = items.map(p => p.id);
        // Garante que todos estão PENDING antes de prosseguir
        const existing = await prisma2_1.prisma.doctorPayment.findMany({
            where: { id: { in: ids } },
            select: { id: true, status: true },
        });
        const notPending = existing.filter(p => p.status !== 'PENDING').map(p => p.id);
        if (notPending.length > 0) {
            return reply.code(409).send({ error: `Repasse(s) não estão pendentes: ${notPending.join(', ')}` });
        }
        // Atualiza individualmente para salvar nfNumber por repasse
        await prisma2_1.prisma.$transaction(items.map(({ id, nfNumber }) => prisma2_1.prisma.doctorPayment.update({
            where: { id },
            data: { status: 'PAID', paidAt: now, nfNumber, notes: notes ?? null },
        })));
        // Sincroniza AccountPayable vinculado (criado automaticamente junto com o repasse)
        const repasseNotes = ids.map(id => `repasse:${id}`);
        await prisma2_1.prisma.accountPayable.updateMany({
            where: { notes: { in: repasseNotes }, status: 'PENDING' },
            data: { status: 'PAID', paidAt: now },
        }).catch(() => { }); // não bloqueia se não existir vinculo
        const uid = request.user?.sub ?? null;
        (0, audit_1.logAudit)({ userId: uid, action: 'MARK_PAID_DOCTOR_PAYMENTS', entity: 'DoctorPayment', metadata: { ids, count: items.length }, request });
        return reply.send({ updated: items.length });
    });
    // PATCH /doctor-payments/:id/cancel — cancela repasse individual
    app.patch('/doctor-payments/:id/cancel', async (request, reply) => {
        const params = idParam.safeParse(request.params);
        if (!params.success)
            return reply.code(400).send({ error: params.error.flatten() });
        try {
            const dp = await prisma2_1.prisma.doctorPayment.update({
                where: { id: params.data.id },
                data: { status: 'CANCELLED' },
            });
            // Cancela AccountPayable vinculado
            await prisma2_1.prisma.accountPayable.updateMany({
                where: { notes: `repasse:${dp.id}`, status: 'PENDING' },
                data: { status: 'CANCELLED' },
            }).catch(() => { });
            const uid = request.user?.sub ?? null;
            (0, audit_1.logAudit)({ userId: uid, action: 'CANCEL_DOCTOR_PAYMENT', entity: 'DoctorPayment', entityId: dp.id, request });
            return reply.send(dp);
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2025')
                return reply.code(404).send({ error: 'Repasse não encontrado' });
            throw err;
        }
    });
}
// ─── Função auxiliar: cria repasse automático após pagamento confirmado ────────
// Chamada dentro de payments.routes ao marcar status → PAID
async function createDoctorPaymentIfNeeded(paymentId) {
    const payment = await prisma2_1.prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
            appointment: {
                include: {
                    doctor: {
                        select: {
                            id: true,
                            repasseType: true,
                            repasseValue: true,
                            user: { select: { name: true } },
                        },
                    },
                },
            },
        },
    });
    if (!payment?.appointment)
        return;
    const { appointment } = payment;
    const doctor = appointment.doctor;
    // Já existe repasse para essa consulta?
    const exists = await prisma2_1.prisma.doctorPayment.findUnique({ where: { appointmentId: appointment.id } });
    if (exists)
        return;
    if (!doctor.repasseValue)
        return;
    const consultaValue = payment.amount;
    const repasseAmount = doctor.repasseType === 'PERCENTAGE'
        ? (consultaValue * doctor.repasseValue) / 100
        : doctor.repasseValue;
    // Cria o DoctorPayment
    const dp = await prisma2_1.prisma.doctorPayment.create({
        data: {
            doctorId: doctor.id,
            appointmentId: appointment.id,
            paymentId: payment.id,
            amount: repasseAmount,
            status: 'PENDING',
        },
    });
    // Cria lançamento em Contas a Pagar vinculado ao repasse
    const doctorName = doctor.user?.name ?? 'Médico';
    const consultaDate = new Date(appointment.startTime).toLocaleDateString('pt-BR');
    await prisma2_1.prisma.accountPayable.create({
        data: {
            description: `Repasse ${doctorName} - consulta ${consultaDate}`,
            category: 'Repasse Médico',
            supplier: doctorName,
            amount: repasseAmount,
            dueDate: new Date(),
            status: 'PENDING',
            notes: `repasse:${dp.id}`,
        },
    });
}
