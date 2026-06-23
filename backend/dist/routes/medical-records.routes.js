"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.medicalRecordsRoutes = medicalRecordsRoutes;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const auth_1 = require("../plugins/auth");
const prisma2_1 = require("../lib/prisma2");
const prisma_errors_1 = require("../lib/prisma-errors");
// ============================================================
// SCHEMAS DE VALIDAÇÃO (Zod)
// ============================================================
// Schema MedicalRecord:
//   patientId, doctorId (obrigatórios)
//   appointmentId? (UNIQUE 1:1 — só 1 prontuário por consulta)
//   campos clínicos: chiefComplaint, historyOfIllness, diagnosis,
//                    prescription, observations (todos opcionais)
//   campos OCR: attachmentUrl, ocrText, ocrSummary (preenchidos por /ocr)
// IDs são CUIDs: z.string().min(1)
// Por que limites generosos? Prontuário pode ter texto longo (anamnese, prescrição...).
const longText = zod_1.z.string().max(10_000).optional();
const vitalSchema = {
    bloodPressure: zod_1.z.string().max(20).optional(),
    heartRate: zod_1.z.coerce.number().int().min(1).max(400).optional(),
    temperature: zod_1.z.coerce.number().min(30).max(45).optional(),
    weight: zod_1.z.coerce.number().min(1).max(500).optional(),
    height: zod_1.z.coerce.number().min(20).max(300).optional(),
    oxygenSaturation: zod_1.z.coerce.number().min(0).max(100).optional(),
};
const historySchema = {
    currentMedications: longText,
    pastConditions: longText,
    pastSurgeries: longText,
    familyHistory: longText,
    smokingStatus: zod_1.z.enum(['NEVER', 'FORMER', 'CURRENT']).optional(),
    alcoholStatus: zod_1.z.enum(['NEVER', 'OCCASIONAL', 'REGULAR']).optional(),
    physicalActivity: zod_1.z.enum(['SEDENTARY', 'LIGHT', 'MODERATE', 'INTENSE']).optional(),
    specialtyData: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
};
const createSchema = zod_1.z.object({
    patientId: zod_1.z.string().min(1, 'patientId obrigatório'),
    doctorId: zod_1.z.string().min(1, 'doctorId obrigatório'),
    appointmentId: zod_1.z.string().min(1).optional(),
    chiefComplaint: longText,
    historyOfIllness: longText,
    diagnosis: longText,
    prescription: longText,
    observations: longText,
    ...vitalSchema,
    ...historySchema,
    // Permite criar já com OCR (caso da rota /ocr criar prontuário direto)
    attachmentUrl: zod_1.z.string().url().optional(),
    ocrText: zod_1.z.string().max(50_000).optional(),
    ocrSummary: zod_1.z.string().max(10_000).optional(),
    transcript: zod_1.z.string().max(100_000).optional(),
});
const updateSchema = zod_1.z.object({
    // patientId/doctorId/appointmentId NÃO podem ser alterados após criação
    chiefComplaint: longText,
    historyOfIllness: longText,
    diagnosis: longText,
    prescription: longText,
    observations: longText,
    ...vitalSchema,
    ...historySchema,
    attachmentUrl: zod_1.z.string().url().nullable().optional(),
    ocrText: zod_1.z.string().max(50_000).nullable().optional(),
    ocrSummary: zod_1.z.string().max(10_000).nullable().optional(),
    transcript: zod_1.z.string().max(100_000).nullable().optional(),
});
// Body para anexar resultado de OCR — todos opcionais mas pelo menos um deve vir
const attachOcrSchema = zod_1.z
    .object({
    attachmentUrl: zod_1.z.string().url().optional(),
    ocrText: zod_1.z.string().max(50_000).optional(),
    ocrSummary: zod_1.z.string().max(10_000).optional(),
})
    .refine((d) => d.attachmentUrl || d.ocrText || d.ocrSummary, { message: 'Informe ao menos um dos campos: attachmentUrl, ocrText, ocrSummary' });
const idParamSchema = zod_1.z.object({ id: zod_1.z.string().min(1, 'ID inválido') });
const listQuerySchema = zod_1.z.object({
    patientId: zod_1.z.string().min(1).optional(),
    doctorId: zod_1.z.string().min(1).optional(),
    appointmentId: zod_1.z.string().min(1).optional(),
    q: zod_1.z.string().optional(), // busca em diagnosis/chiefComplaint/observations
    from: zod_1.z.coerce.date().optional(), // intervalo em createdAt
    to: zod_1.z.coerce.date().optional(),
    take: zod_1.z.coerce.number().int().positive().max(100).default(50),
    skip: zod_1.z.coerce.number().int().min(0).default(0),
});
// ============================================================
// HELPERS
// ============================================================
// Include padrão — sem vazar passwordHash, CPF do paciente em listas, etc.
// Detalhes mais sensíveis (CPF, alergias) só no GET /:id.
const recordListInclude = {
    patient: { select: { id: true, fullName: true } },
    doctor: {
        select: {
            id: true,
            crm: true,
            specialty: true,
            user: { select: { id: true, name: true } },
        },
    },
    appointment: {
        select: { id: true, startTime: true, endTime: true, status: true },
    },
};
// Include detalhado — usado no GET /:id (médico precisa ver mais contexto do paciente)
const recordDetailInclude = {
    patient: {
        select: {
            id: true,
            fullName: true,
            cpf: true,
            birthDate: true,
            gender: true,
            bloodType: true,
            allergies: true,
            phone: true,
            email: true,
            healthInsurance: true,
        },
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
    appointment: {
        select: {
            id: true,
            startTime: true,
            endTime: true,
            status: true,
            reason: true,
            insurancePlanId: true,
        },
    },
};
// ============================================================
// ROTAS
// ============================================================
async function medicalRecordsRoutes(app) {
    app.addHook('preHandler', (0, auth_1.requireRole)('ADMIN', 'DOCTOR'));
    // ---------------------------------------------------------
    // POST /medical-records — criar prontuário
    // ---------------------------------------------------------
    app.post('/medical-records', async (request, reply) => {
        const parsed = createSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.flatten() });
        }
        const data = parsed.data;
        try {
            // Validar paciente
            const patient = await prisma2_1.prisma.patient.findUnique({
                where: { id: data.patientId },
                select: { id: true },
            });
            if (!patient)
                return reply.code(404).send({ error: 'Paciente não encontrado' });
            // Validar médico
            const doctor = await prisma2_1.prisma.doctor.findUnique({
                where: { id: data.doctorId },
                select: { id: true },
            });
            if (!doctor)
                return reply.code(404).send({ error: 'Médico não encontrado' });
            // Validar appointment (se informado)
            if (data.appointmentId) {
                const appointment = await prisma2_1.prisma.appointment.findUnique({
                    where: { id: data.appointmentId },
                    select: {
                        id: true,
                        patientId: true,
                        doctorId: true,
                        medicalRecord: { select: { id: true } },
                    },
                });
                if (!appointment) {
                    return reply.code(404).send({ error: 'Consulta não encontrada' });
                }
                if (appointment.patientId !== data.patientId) {
                    return reply.code(400).send({
                        error: 'A consulta informada não pertence a esse paciente',
                    });
                }
                if (appointment.doctorId !== data.doctorId) {
                    return reply.code(400).send({
                        error: 'A consulta informada não pertence a esse médico',
                    });
                }
                if (appointment.medicalRecord) {
                    return reply.code(409).send({
                        error: 'Já existe um prontuário associado a essa consulta',
                    });
                }
            }
            const created = await prisma2_1.prisma.medicalRecord.create({
                data: {
                    ...data,
                    specialtyData: data.specialtyData,
                },
                include: recordDetailInclude,
            });
            const userId = request.user?.sub ?? null;
            await prisma2_1.prisma.auditLog.create({
                data: {
                    userId,
                    action: 'CREATE',
                    entity: 'MedicalRecord',
                    entityId: created.id,
                    metadata: { patientId: created.patientId, doctorId: created.doctorId, appointmentId: created.appointmentId },
                    ipAddress: request.ip,
                    userAgent: request.headers['user-agent'] ?? null,
                },
            }).catch(() => { }); // audit não deve bloquear a resposta
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
            return reply.code(500).send({ error: 'Erro interno ao criar prontuário' });
        }
    });
    // ---------------------------------------------------------
    // GET /medical-records — listagem com filtros + paginação
    // ---------------------------------------------------------
    app.get('/medical-records', async (request, reply) => {
        const parsed = listQuerySchema.safeParse(request.query);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.flatten() });
        }
        const { patientId, doctorId, appointmentId, q, from, to, take, skip } = parsed.data;
        const where = {
            ...(patientId ? { patientId } : {}),
            ...(doctorId ? { doctorId } : {}),
            ...(appointmentId ? { appointmentId } : {}),
            ...(q
                ? {
                    OR: [
                        { diagnosis: { contains: q } },
                        { chiefComplaint: { contains: q } },
                        { observations: { contains: q } },
                    ],
                }
                : {}),
            ...(from || to
                ? { createdAt: { gte: from ?? undefined, lte: to ?? undefined } }
                : {}),
        };
        const [data, total] = await Promise.all([
            prisma2_1.prisma.medicalRecord.findMany({
                where,
                take,
                skip,
                orderBy: { createdAt: 'desc' }, // mais recentes primeiro
                include: recordListInclude,
            }),
            prisma2_1.prisma.medicalRecord.count({ where }),
        ]);
        return reply.send({ data, total, take, skip });
    });
    // ---------------------------------------------------------
    // GET /medical-records/:id — detalhe completo
    // ---------------------------------------------------------
    app.get('/medical-records/:id', async (request, reply) => {
        const parsed = idParamSchema.safeParse(request.params);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.flatten() });
        }
        const found = await prisma2_1.prisma.medicalRecord.findUnique({
            where: { id: parsed.data.id },
            include: recordDetailInclude,
        });
        if (!found)
            return reply.code(404).send({ error: 'Prontuário não encontrado' });
        return reply.send(found);
    });
    // ---------------------------------------------------------
    // PATCH /medical-records/:id — atualizar campos clínicos
    // ---------------------------------------------------------
    // Por que não permitir mudar patientId/doctorId/appointmentId?
    // Quebraria rastreabilidade. Se errou paciente, crie outro registro
    // e marque o anterior com observação de "registro substituído".
    app.patch('/medical-records/:id', async (request, reply) => {
        const params = idParamSchema.safeParse(request.params);
        const body = updateSchema.safeParse(request.body);
        if (!params.success)
            return reply.code(400).send({ error: params.error.flatten() });
        if (!body.success)
            return reply.code(400).send({ error: body.error.flatten() });
        try {
            // Carrega estado anterior para o log de auditoria
            const before = await prisma2_1.prisma.medicalRecord.findUnique({
                where: { id: params.data.id },
                select: { chiefComplaint: true, historyOfIllness: true, diagnosis: true, prescription: true, observations: true },
            });
            const updated = await prisma2_1.prisma.medicalRecord.update({
                where: { id: params.data.id },
                data: {
                    ...body.data,
                    specialtyData: body.data.specialtyData,
                },
                include: recordDetailInclude,
            });
            const userId = request.user?.sub ?? null;
            await prisma2_1.prisma.auditLog.create({
                data: {
                    userId,
                    action: 'UPDATE',
                    entity: 'MedicalRecord',
                    entityId: updated.id,
                    metadata: { before, after: body.data },
                    ipAddress: request.ip,
                    userAgent: request.headers['user-agent'] ?? null,
                },
            }).catch(() => { });
            return reply.send(updated);
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                if (err.code === 'P2025') {
                    return reply.code(404).send({ error: 'Prontuário não encontrado' });
                }
                if (err.code === 'P2002') {
                    const target = (0, prisma_errors_1.extractUniqueViolationFields)(err.meta);
                    return reply.code(409).send({
                        error: `Já existe um registro com esse(s) campo(s): ${target}`,
                    });
                }
            }
            request.log.error(err);
            return reply.code(500).send({ error: 'Erro interno ao atualizar prontuário' });
        }
    });
    // ---------------------------------------------------------
    // POST /medical-records/:id/attach-ocr — anexar resultado de OCR
    // ---------------------------------------------------------
    // Endpoint semântico para o fluxo: médico cria prontuário → faz upload
    // de imagem do exame → OCR é processado → resultado anexado AQUI.
    // (A rota /ocr também pode CRIAR um novo prontuário com OCR direto.)
    app.post('/medical-records/:id/attach-ocr', async (request, reply) => {
        const params = idParamSchema.safeParse(request.params);
        const body = attachOcrSchema.safeParse(request.body);
        if (!params.success)
            return reply.code(400).send({ error: params.error.flatten() });
        if (!body.success)
            return reply.code(400).send({ error: body.error.flatten() });
        try {
            const updated = await prisma2_1.prisma.medicalRecord.update({
                where: { id: params.data.id },
                data: body.data,
                include: recordDetailInclude,
            });
            return reply.send(updated);
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
                return reply.code(404).send({ error: 'Prontuário não encontrado' });
            }
            request.log.error(err);
            return reply.code(500).send({ error: 'Erro interno ao anexar OCR' });
        }
    });
    // ---------------------------------------------------------
    // DELETE /medical-records/:id — BLOQUEADO por padrão
    // ---------------------------------------------------------
    // Prontuário médico tem retenção legal mínima de 20 anos (CFM 1.821/2007).
    // Não expomos delete real. Para correções, use PATCH (e registre a correção).
    // Para apagar dados de teste em DEV: use Prisma Studio ou SQL direto.
    app.delete('/medical-records/:id', async (_request, reply) => {
        return reply.code(405).send({
            error: 'Prontuários médicos não podem ser apagados (retenção legal de 20 anos - CFM 1.821/2007). ' +
                'Use PATCH para corrigir informações.',
        });
    });
}
