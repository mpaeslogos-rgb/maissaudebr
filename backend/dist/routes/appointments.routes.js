"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appointmentsRoutes = appointmentsRoutes;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const auth_1 = require("../plugins/auth");
const prisma2_1 = require("../lib/prisma2");
const prisma_errors_1 = require("../lib/prisma-errors");
const audit_1 = require("../lib/audit");
// ============================================================
// SCHEMAS DE VALIDAÇÃO (Zod)
// ============================================================
// Schema usa: startTime, endTime (NÃO scheduledAt/duration!)
// IDs são CUIDs: z.string().min(1) (NUNCA .uuid())
// AppointmentStatus: SCHEDULED | CONFIRMED | IN_PROGRESS | COMPLETED | CANCELLED | NO_SHOW
const statusEnum = zod_1.z.enum([
    'SCHEDULED',
    'CONFIRMED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'NO_SHOW',
]);
const createSchema = zod_1.z
    .object({
    patientId: zod_1.z.string().min(1, 'patientId obrigatório'),
    doctorId: zod_1.z.string().min(1, 'doctorId obrigatório'),
    startTime: zod_1.z.coerce.date(),
    endTime: zod_1.z.coerce.date(),
    reason: zod_1.z.string().max(500).optional(),
    notes: zod_1.z.string().max(2000).optional(),
    amount: zod_1.z.number().positive().optional(),
    isReturn: zod_1.z.boolean().optional(),
    insurancePlanId: zod_1.z.string().optional(),
})
    .refine((d) => d.startTime < d.endTime, {
    message: 'startTime deve ser anterior a endTime',
    path: ['endTime'],
})
    .refine((d) => d.startTime.getTime() > Date.now(), {
    message: 'startTime deve estar no futuro',
    path: ['startTime'],
});
const updateSchema = zod_1.z
    .object({
    startTime: zod_1.z.coerce.date().optional(),
    endTime: zod_1.z.coerce.date().optional(),
    status: statusEnum.optional(),
    reason: zod_1.z.string().max(500).optional(),
    notes: zod_1.z.string().max(2000).optional(),
})
    .refine((d) => {
    if (d.startTime && d.endTime)
        return d.startTime < d.endTime;
    return true;
}, { message: 'startTime deve ser anterior a endTime', path: ['endTime'] });
const idParamSchema = zod_1.z.object({ id: zod_1.z.string().min(1, 'ID inválido') });
const listQuerySchema = zod_1.z.object({
    doctorId: zod_1.z.string().min(1).optional(),
    patientId: zod_1.z.string().min(1).optional(),
    status: statusEnum.optional(),
    from: zod_1.z.coerce.date().optional(),
    to: zod_1.z.coerce.date().optional(),
    take: zod_1.z.coerce.number().int().positive().max(100).default(50),
    skip: zod_1.z.coerce.number().int().min(0).default(0),
});
// ============================================================
// MÁQUINA DE ESTADOS (transições válidas)
// ============================================================
// Por que? Sem isso, alguém poderia voltar uma consulta de COMPLETED para SCHEDULED.
const VALID_TRANSITIONS = {
    SCHEDULED: ['CONFIRMED', 'CANCELLED', 'NO_SHOW'],
    CONFIRMED: ['IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
    IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [], // estado terminal
    CANCELLED: [], // estado terminal
    NO_SHOW: [], // estado terminal
};
function isValidTransition(from, to) {
    if (from === to)
        return true; // idempotente
    return VALID_TRANSITIONS[from].includes(to);
}
// ============================================================
// HELPERS
// ============================================================
/**
 * Detecta sobreposição de horário do mesmo médico.
 * Regra de overlap clássica: [A_start, A_end) intersecta [B_start, B_end)
 * sse  A_start < B_end  AND  A_end > B_start.
 *
 * Por que findFirst? Só precisamos saber SE existe — não precisamos da lista.
 * Por que notIn CANCELLED/NO_SHOW? Consultas canceladas liberam o horário.
 */
async function hasScheduleConflict(doctorId, start, end, excludeId) {
    const conflict = await prisma2_1.prisma.appointment.findFirst({
        where: {
            doctorId,
            id: excludeId ? { not: excludeId } : undefined,
            status: { notIn: ['CANCELLED', 'NO_SHOW'] },
            startTime: { lt: end },
            endTime: { gt: start },
        },
        select: { id: true },
    });
    return conflict !== null;
}
// Include padrão para respostas (sem vazar passwordHash, endereço completo, etc.)
const appointmentInclude = {
    patient: {
        select: { id: true, fullName: true, cpf: true, phone: true, email: true },
    },
    doctor: {
        select: {
            id: true,
            crm: true,
            crmState: true,
            specialty: true,
            user: { select: { id: true, name: true, email: true } },
        },
    },
};
// ============================================================
// ROTAS
// ============================================================
async function appointmentsRoutes(app) {
    app.addHook('preHandler', (0, auth_1.requireRole)('ADMIN', 'DOCTOR', 'RECEPTIONIST'));
    // ---------------------------------------------------------
    // POST /appointments — agendar consulta
    // ---------------------------------------------------------
    app.post('/appointments', async (request, reply) => {
        const parsed = createSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.flatten() });
        }
        const { patientId, doctorId, startTime, endTime, reason, notes, amount, isReturn, insurancePlanId } = parsed.data;
        try {
            // Valida existência ANTES de tentar inserir (mensagens mais claras que P2003)
            const [patient, doctor] = await Promise.all([
                prisma2_1.prisma.patient.findUnique({ where: { id: patientId }, select: { id: true } }),
                prisma2_1.prisma.doctor.findUnique({
                    where: { id: doctorId },
                    select: { id: true, consultationFee: true, specialty: true, repasseType: true, repasseValue: true, user: { select: { name: true } } },
                }),
            ]);
            if (!patient)
                return reply.code(404).send({ error: 'Paciente não encontrado' });
            if (!doctor)
                return reply.code(404).send({ error: 'Médico não encontrado' });
            if (await hasScheduleConflict(doctorId, startTime, endTime)) {
                return reply.code(409).send({
                    error: 'Conflito de horário: o médico já tem uma consulta nesse intervalo',
                });
            }
            const created = await prisma2_1.prisma.appointment.create({
                data: { patientId, doctorId, startTime, endTime, reason, notes, isReturn: isReturn ?? false, insurancePlanId },
                include: appointmentInclude,
            });
            // Regra de cobrança:
            // - Retorno particular → sem cobrança
            // - Retorno convênio  → cobra pelo contrato do plano
            // - Primeira consulta → cobra normalmente
            const isParticularReturn = (isReturn === true) && !insurancePlanId;
            if (!isParticularReturn) {
                let chargeAmount = amount ?? doctor.consultationFee;
                // Se tem convênio, busca valor do contrato ativo
                if (insurancePlanId) {
                    const contract = await prisma2_1.prisma.insuranceContract.findFirst({
                        where: {
                            planId: insurancePlanId,
                            startDate: { lte: startTime },
                            OR: [{ endDate: null }, { endDate: { gte: startTime } }],
                        },
                    });
                    if (contract?.consultationFee != null)
                        chargeAmount = contract.consultationFee;
                }
                if (chargeAmount) {
                    const doctorName = doctor.user?.name ?? doctorId;
                    const paymentMethod = insurancePlanId ? 'HEALTH_INSURANCE' : undefined;
                    await prisma2_1.prisma.payment.create({
                        data: {
                            patientId,
                            appointmentId: created.id,
                            amount: chargeAmount,
                            dueDate: startTime,
                            method: paymentMethod,
                            description: `Consulta${isReturn ? ' (retorno)' : ''} — ${doctor.specialty} (${doctorName})`,
                        },
                    });
                }
            }
            const uid = request.user?.sub ?? null;
            (0, audit_1.logAudit)({ userId: uid, action: 'CREATE', entity: 'Appointment', entityId: created.id, request });
            return reply.code(201).send(created);
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                const target = (0, prisma_errors_1.extractUniqueViolationFields)(err.meta);
                return reply.code(409).send({
                    error: `Já existe um registro com esse(s) campo(s): ${target}`,
                });
            }
            request.log.error(err);
            return reply.code(500).send({ error: 'Erro interno ao criar consulta' });
        }
    });
    // ---------------------------------------------------------
    // GET /appointments — listagem com filtros + paginação
    // ---------------------------------------------------------
    app.get('/appointments', async (request, reply) => {
        const parsed = listQuerySchema.safeParse(request.query);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.flatten() });
        }
        const { doctorId, patientId, status, from, to, take, skip } = parsed.data;
        const where = {
            doctorId,
            patientId,
            status,
            // Filtra consultas cujo startTime cai no intervalo [from, to]
            ...(from || to
                ? { startTime: { gte: from ?? undefined, lte: to ?? undefined } }
                : {}),
        };
        const [data, total] = await Promise.all([
            prisma2_1.prisma.appointment.findMany({
                where,
                take,
                skip,
                orderBy: { startTime: 'asc' },
                include: appointmentInclude,
            }),
            prisma2_1.prisma.appointment.count({ where }),
        ]);
        return reply.send({ data, total, take, skip });
    });
    // ---------------------------------------------------------
    // GET /appointments/:id — detalhe completo
    // ---------------------------------------------------------
    app.get('/appointments/:id', async (request, reply) => {
        const parsed = idParamSchema.safeParse(request.params);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.flatten() });
        }
        const found = await prisma2_1.prisma.appointment.findUnique({
            where: { id: parsed.data.id },
            include: {
                ...appointmentInclude,
                medicalRecord: true,
                payment: true,
            },
        });
        if (!found)
            return reply.code(404).send({ error: 'Consulta não encontrada' });
        return reply.send(found);
    });
    // ---------------------------------------------------------
    // PATCH /appointments/:id — re-agendar / mudar status / notas
    // ---------------------------------------------------------
    app.patch('/appointments/:id', async (request, reply) => {
        const params = idParamSchema.safeParse(request.params);
        const body = updateSchema.safeParse(request.body);
        if (!params.success)
            return reply.code(400).send({ error: params.error.flatten() });
        if (!body.success)
            return reply.code(400).send({ error: body.error.flatten() });
        try {
            const current = await prisma2_1.prisma.appointment.findUnique({
                where: { id: params.data.id },
                select: { id: true, doctorId: true, startTime: true, endTime: true, status: true },
            });
            if (!current)
                return reply.code(404).send({ error: 'Consulta não encontrada' });
            // Validação de transição de status
            if (body.data.status && !isValidTransition(current.status, body.data.status)) {
                return reply.code(422).send({
                    error: `Transição de status inválida: ${current.status} → ${body.data.status}`,
                    allowed: VALID_TRANSITIONS[current.status],
                });
            }
            // Re-validação de conflito se horário mudou
            if (body.data.startTime || body.data.endTime) {
                const newStart = body.data.startTime ?? current.startTime;
                const newEnd = body.data.endTime ?? current.endTime;
                if (newStart >= newEnd) {
                    return reply.code(400).send({ error: 'startTime deve ser anterior a endTime' });
                }
                if (await hasScheduleConflict(current.doctorId, newStart, newEnd, current.id)) {
                    return reply.code(409).send({
                        error: 'Conflito de horário: o médico já tem uma consulta nesse intervalo',
                    });
                }
            }
            const updated = await prisma2_1.prisma.appointment.update({
                where: { id: params.data.id },
                data: body.data,
                include: appointmentInclude,
            });
            const uid = request.user?.sub ?? null;
            const action = body.data.status ? `STATUS_${body.data.status}` : 'UPDATE';
            (0, audit_1.logAudit)({ userId: uid, action, entity: 'Appointment', entityId: updated.id, request });
            return reply.send(updated);
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                if (err.code === 'P2025') {
                    return reply.code(404).send({ error: 'Consulta não encontrada' });
                }
                if (err.code === 'P2002') {
                    const target = (0, prisma_errors_1.extractUniqueViolationFields)(err.meta);
                    return reply.code(409).send({
                        error: `Já existe um registro com esse(s) campo(s): ${target}`,
                    });
                }
            }
            request.log.error(err);
            return reply.code(500).send({ error: 'Erro interno ao atualizar consulta' });
        }
    });
    // ---------------------------------------------------------
    // DELETE /appointments/:id — soft cancel (status: CANCELLED)
    // ---------------------------------------------------------
    // Por que não delete real? Histórico clínico/financeiro precisa ser auditável.
    app.delete('/appointments/:id', async (request, reply) => {
        const parsed = idParamSchema.safeParse(request.params);
        if (!parsed.success)
            return reply.code(400).send({ error: parsed.error.flatten() });
        try {
            const current = await prisma2_1.prisma.appointment.findUnique({
                where: { id: parsed.data.id },
                select: { status: true },
            });
            if (!current)
                return reply.code(404).send({ error: 'Consulta não encontrada' });
            if (current.status === 'CANCELLED') {
                // Hard-delete: consulta cancelada pode ser removida definitivamente
                await prisma2_1.prisma.appointment.delete({ where: { id: parsed.data.id } });
                return reply.send({ message: 'Consulta removida.' });
            }
            if (current.status === 'COMPLETED') {
                return reply.code(409).send({ error: 'Consulta concluída não pode ser cancelada' });
            }
            const cancelled = await prisma2_1.prisma.appointment.update({
                where: { id: parsed.data.id },
                data: { status: 'CANCELLED' },
                include: appointmentInclude,
            });
            // Cancelar cobrança pendente vinculada, se houver
            await prisma2_1.prisma.payment.updateMany({
                where: { appointmentId: cancelled.id, status: { in: ['PENDING', 'OVERDUE'] } },
                data: { status: 'CANCELLED' },
            });
            const uid = request.user?.sub ?? null;
            (0, audit_1.logAudit)({ userId: uid, action: 'CANCEL', entity: 'Appointment', entityId: cancelled.id, request });
            return reply.send(cancelled);
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
                return reply.code(404).send({ error: 'Consulta não encontrada' });
            }
            request.log.error(err);
            return reply.code(500).send({ error: 'Erro interno ao cancelar consulta' });
        }
    });
}
