"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.doctorsRoutes = doctorsRoutes;
const zod_1 = require("zod");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = require("@prisma/client");
const auth_1 = require("../plugins/auth");
const prisma2_1 = require("../lib/prisma2");
const prisma_errors_1 = require("../lib/prisma-errors");
const audit_1 = require("../lib/audit");
// ============================================================
// SCHEMAS DE VALIDAÇÃO (Zod)
// ============================================================
// IMPORTANTE: User usa `name`, Patient usa `fullName`
// IDs no Prisma 7 são CUIDs (não UUIDs)
const createDoctorSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    crm: zod_1.z.string().min(3),
    crmState: zod_1.z.string().length(2),
    cpf: zod_1.z.string().optional(),
    specialty: zod_1.z.string().min(2),
    consultationFee: zod_1.z.number().positive().optional(),
    phone: zod_1.z.string().optional(),
    bio: zod_1.z.string().optional(),
    workStartHour: zod_1.z.number().int().min(0).max(23).default(8),
    workEndHour: zod_1.z.number().int().min(1).max(24).default(18),
});
const updateDoctorSchema = zod_1.z.object({
    specialty: zod_1.z.string().min(2).optional(),
    cpf: zod_1.z.string().nullable().optional(),
    consultationFee: zod_1.z.number().positive().nullable().optional(),
    phone: zod_1.z.string().nullable().optional(),
    bio: zod_1.z.string().nullable().optional(),
    crmState: zod_1.z.string().length(2).optional(),
    workStartHour: zod_1.z.number().int().min(0).max(23).optional(),
    workEndHour: zod_1.z.number().int().min(1).max(24).optional(),
    repasseType: zod_1.z.enum(['PERCENTAGE', 'FIXED']).optional(),
    repasseValue: zod_1.z.number().min(0).nullable().optional(),
});
const idParamSchema = zod_1.z.object({ id: zod_1.z.string().min(1, 'ID inválido') });
const listQuerySchema = zod_1.z.object({
    q: zod_1.z.string().optional(),
    take: zod_1.z.coerce.number().int().positive().max(100).default(50),
    skip: zod_1.z.coerce.number().int().min(0).default(0),
});
// ============================================================
// ROTAS
// ============================================================
async function doctorsRoutes(app) {
    // Todos podem listar/ver médicos; só ADMIN pode criar/editar/excluir
    app.addHook('preHandler', (0, auth_1.requireRole)('ADMIN', 'DOCTOR', 'RECEPTIONIST'));
    // POST /doctors — cria User + Doctor em transação atômica
    app.post('/doctors', { preHandler: (0, auth_1.requireRole)('ADMIN') }, async (request, reply) => {
        const parsed = createDoctorSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.flatten() });
        }
        const { name, email, password, crm, crmState, specialty, consultationFee, phone, bio, workStartHour, workEndHour } = parsed.data;
        try {
            const passwordHash = await bcryptjs_1.default.hash(password, 10);
            const result = await prisma2_1.prisma.$transaction(async (tx) => {
                const user = await tx.user.create({
                    data: { name, email, passwordHash, role: 'DOCTOR' },
                });
                const doctor = await tx.doctor.create({
                    data: {
                        userId: user.id,
                        crm,
                        crmState: crmState.toUpperCase(),
                        specialty,
                        consultationFee,
                        phone,
                        bio,
                        workStartHour,
                        workEndHour,
                    },
                    include: {
                        user: {
                            select: { id: true, name: true, email: true, role: true, isActive: true },
                        },
                    },
                });
                return doctor;
            });
            const uid = request.user?.sub ?? null;
            (0, audit_1.logAudit)({ userId: uid, action: 'CREATE_DOCTOR', entity: 'Doctor', entityId: result.id, request });
            return reply.code(201).send(result);
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                const target = (0, prisma_errors_1.extractUniqueViolationFields)(err.meta);
                return reply.code(409).send({
                    error: `Já existe um registro com esse(s) campo(s): ${target}`,
                });
            }
            request.log.error(err);
            return reply.code(500).send({ error: 'Erro interno ao criar médico' });
        }
    });
    // GET /doctors — listagem com paginação e busca
    app.get('/doctors', async (request, reply) => {
        const parsed = listQuerySchema.safeParse(request.query);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.flatten() });
        }
        const { q, take, skip } = parsed.data;
        const where = q
            ? {
                OR: [
                    { crm: { contains: q } },
                    { specialty: { contains: q } },
                    { user: { name: { contains: q } } },
                ],
            }
            : {};
        const [data, total] = await Promise.all([
            prisma2_1.prisma.doctor.findMany({
                where,
                take,
                skip,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: { select: { id: true, name: true, email: true, isActive: true } },
                },
            }),
            prisma2_1.prisma.doctor.count({ where }),
        ]);
        return reply.send({ data, total, take, skip });
    });
    // GET /doctors/:id — detalhe + appointments recentes
    app.get('/doctors/:id', async (request, reply) => {
        const parsed = idParamSchema.safeParse(request.params);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.flatten() });
        }
        const doctor = await prisma2_1.prisma.doctor.findUnique({
            where: { id: parsed.data.id },
            include: {
                user: {
                    select: { id: true, name: true, email: true, role: true, isActive: true },
                },
                appointments: {
                    take: 10,
                    orderBy: { startTime: 'desc' },
                    include: {
                        patient: { select: { id: true, fullName: true, cpf: true } },
                    },
                },
            },
        });
        if (!doctor)
            return reply.code(404).send({ error: 'Médico não encontrado' });
        return reply.send(doctor);
    });
    // PATCH /doctors/:id
    app.patch('/doctors/:id', { preHandler: (0, auth_1.requireRole)('ADMIN') }, async (request, reply) => {
        const params = idParamSchema.safeParse(request.params);
        const body = updateDoctorSchema.safeParse(request.body);
        if (!params.success)
            return reply.code(400).send({ error: params.error.flatten() });
        if (!body.success)
            return reply.code(400).send({ error: body.error.flatten() });
        try {
            const d = body.data;
            request.log.info({ bodyData: d }, '[PATCH doctor] body.data recebido');
            const updateData = {};
            if (d.specialty !== undefined)
                updateData.specialty = d.specialty;
            if (d.crmState !== undefined)
                updateData.crmState = d.crmState.toUpperCase();
            if (d.cpf !== undefined)
                updateData.cpf = d.cpf;
            if (d.phone !== undefined)
                updateData.phone = d.phone;
            if (d.bio !== undefined)
                updateData.bio = d.bio;
            if (d.consultationFee !== undefined)
                updateData.consultationFee = d.consultationFee;
            if (d.workStartHour !== undefined)
                updateData.workStartHour = d.workStartHour;
            if (d.workEndHour !== undefined)
                updateData.workEndHour = d.workEndHour;
            if (d.repasseType !== undefined)
                updateData.repasseType = d.repasseType;
            if (d.repasseValue !== undefined)
                updateData.repasseValue = d.repasseValue;
            request.log.info({ updateData }, '[PATCH doctor] updateData a persistir');
            const updated = await prisma2_1.prisma.doctor.update({
                where: { id: params.data.id },
                data: updateData,
                include: {
                    user: { select: { id: true, name: true, email: true, isActive: true } },
                },
            });
            const uid = request.user?.sub ?? null;
            (0, audit_1.logAudit)({ userId: uid, action: 'UPDATE_DOCTOR', entity: 'Doctor', entityId: updated.id, request });
            return reply.send(updated);
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                if (err.code === 'P2025') {
                    return reply.code(404).send({ error: 'Médico não encontrado' });
                }
                if (err.code === 'P2002') {
                    const target = (0, prisma_errors_1.extractUniqueViolationFields)(err.meta);
                    return reply.code(409).send({
                        error: `Já existe um registro com esse(s) campo(s): ${target}`,
                    });
                }
            }
            request.log.error(err);
            return reply.code(500).send({ error: 'Erro interno ao atualizar médico' });
        }
    });
    // DELETE /doctors/:id — soft delete (desativa o User)
    app.delete('/doctors/:id', { preHandler: (0, auth_1.requireRole)('ADMIN') }, async (request, reply) => {
        const parsed = idParamSchema.safeParse(request.params);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.flatten() });
        }
        try {
            const doctor = await prisma2_1.prisma.doctor.findUnique({
                where: { id: parsed.data.id },
                select: { userId: true },
            });
            if (!doctor)
                return reply.code(404).send({ error: 'Médico não encontrado' });
            await prisma2_1.prisma.user.update({
                where: { id: doctor.userId },
                data: { isActive: false },
            });
            const uid = request.user?.sub ?? null;
            (0, audit_1.logAudit)({ userId: uid, action: 'DEACTIVATE_DOCTOR', entity: 'Doctor', entityId: parsed.data.id, request });
            return reply.code(204).send();
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
                return reply.code(404).send({ error: 'Médico não encontrado' });
            }
            request.log.error(err);
            return reply.code(500).send({ error: 'Erro interno ao remover médico' });
        }
    });
}
