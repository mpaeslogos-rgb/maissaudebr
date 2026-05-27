"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.patientsRoutes = patientsRoutes;
const zod_1 = require("zod");
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:stream/promises");
const client_1 = require("@prisma/client");
const prisma2_1 = require("../lib/prisma2");
const auth_1 = require("../plugins/auth");
const audit_1 = require("../lib/audit");
const crypto_1 = require("../lib/crypto");
/** Criptografa campos PII antes de salvar no banco */
function encryptPatient(data) {
    const d = { ...data };
    if ('cpf' in d)
        d.cpf = (0, crypto_1.encryptDeterministic)(d.cpf);
    if ('phone' in d)
        d.phone = (0, crypto_1.encrypt)(d.phone);
    if ('rg' in d)
        d.rg = (0, crypto_1.encrypt)(d.rg);
    if ('zipCode' in d)
        d.zipCode = (0, crypto_1.encrypt)(d.zipCode);
    if ('street' in d)
        d.street = (0, crypto_1.encrypt)(d.street);
    if ('number' in d)
        d.number = (0, crypto_1.encrypt)(d.number);
    if ('complement' in d)
        d.complement = (0, crypto_1.encrypt)(d.complement);
    if ('neighborhood' in d)
        d.neighborhood = (0, crypto_1.encrypt)(d.neighborhood);
    if ('allergies' in d)
        d.allergies = (0, crypto_1.encrypt)(d.allergies);
    if ('notes' in d)
        d.notes = (0, crypto_1.encrypt)(d.notes);
    if ('healthInsuranceNumber' in d)
        d.healthInsuranceNumber = (0, crypto_1.encrypt)(d.healthInsuranceNumber);
    return d;
}
/** Descriptografa campos PII ao ler do banco */
function decryptPatient(data) {
    const d = { ...data };
    if ('cpf' in d)
        d.cpf = (0, crypto_1.decryptDeterministic)(d.cpf);
    if ('phone' in d)
        d.phone = (0, crypto_1.decrypt)(d.phone);
    if ('rg' in d)
        d.rg = (0, crypto_1.decrypt)(d.rg);
    if ('zipCode' in d)
        d.zipCode = (0, crypto_1.decrypt)(d.zipCode);
    if ('street' in d)
        d.street = (0, crypto_1.decrypt)(d.street);
    if ('number' in d)
        d.number = (0, crypto_1.decrypt)(d.number);
    if ('complement' in d)
        d.complement = (0, crypto_1.decrypt)(d.complement);
    if ('neighborhood' in d)
        d.neighborhood = (0, crypto_1.decrypt)(d.neighborhood);
    if ('allergies' in d)
        d.allergies = (0, crypto_1.decrypt)(d.allergies);
    if ('notes' in d)
        d.notes = (0, crypto_1.decrypt)(d.notes);
    if ('healthInsuranceNumber' in d)
        d.healthInsuranceNumber = (0, crypto_1.decrypt)(d.healthInsuranceNumber);
    return d;
}
// ============================================
// SCHEMAS DE VALIDAÇÃO (Zod)
// ============================================
const createPatientSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(2, 'Nome muito curto'),
    cpf: zod_1.z.string().min(11, 'CPF inválido').max(14),
    rg: zod_1.z.string().optional(),
    birthDate: zod_1.z.string().transform((v) => new Date(v)),
    gender: zod_1.z.enum(['MALE', 'FEMALE', 'OTHER']),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().min(8),
    // Endereço (todos opcionais)
    zipCode: zod_1.z.string().optional(),
    street: zod_1.z.string().optional(),
    number: zod_1.z.string().optional(),
    complement: zod_1.z.string().optional(),
    neighborhood: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    // Dados clínicos
    bloodType: zod_1.z.string().optional(),
    allergies: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    // Convênio
    healthInsurance: zod_1.z.string().optional(),
    healthInsuranceNumber: zod_1.z.string().optional(),
});
const updatePatientSchema = createPatientSchema.partial();
const listQuerySchema = zod_1.z.object({
    search: zod_1.z.string().optional(),
    take: zod_1.z.coerce.number().int().positive().max(100).default(50),
    skip: zod_1.z.coerce.number().int().nonnegative().default(0),
});
// ============================================
// ROTAS
// ============================================
async function patientsRoutes(app) {
    // ADMIN e RECEPTIONIST podem criar/editar/excluir; DOCTOR pode apenas consultar
    app.addHook('onRequest', (0, auth_1.requireRole)('ADMIN', 'DOCTOR', 'RECEPTIONIST'));
    // ----- LISTAR (com busca opcional e paginação) -----
    app.get('/patients', async (request, reply) => {
        const parsed = listQuerySchema.safeParse(request.query);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.flatten() });
        }
        const { search, take, skip } = parsed.data;
        const baseWhere = { deletedAt: null };
        const where = search
            ? {
                ...baseWhere,
                OR: [
                    { fullName: { contains: search } },
                    { cpf: { contains: search } },
                    { email: { contains: search } },
                ],
            }
            : baseWhere;
        const [patients, total] = await Promise.all([
            prisma2_1.prisma.patient.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take,
                skip,
            }),
            prisma2_1.prisma.patient.count({ where }),
        ]);
        return { data: patients.map(decryptPatient), total, take, skip };
    });
    // ----- LISTAR EXCLUÍDOS (LGPD — dados anonimizados) -----
    app.get('/patients/deleted', { preHandler: (0, auth_1.requireRole)('ADMIN') }, async (request, reply) => {
        const parsed = listQuerySchema.safeParse(request.query);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.flatten() });
        }
        const { take, skip } = parsed.data;
        const where = { deletedAt: { not: null } };
        const [patients, total] = await Promise.all([
            prisma2_1.prisma.patient.findMany({
                where,
                orderBy: { deletedAt: 'desc' },
                take,
                skip,
                select: {
                    id: true,
                    fullName: true,
                    deletedAt: true,
                    createdAt: true,
                    updatedAt: true,
                },
            }),
            prisma2_1.prisma.patient.count({ where }),
        ]);
        return reply.send({ data: patients, total, take, skip });
    });
    // ----- BUSCAR POR ID -----
    app.get('/patients/:id', async (request, reply) => {
        const { id } = request.params;
        const patient = await prisma2_1.prisma.patient.findUnique({
            where: { id },
            include: {
                appointments: {
                    orderBy: { startTime: 'desc' },
                    take: 10,
                    include: { doctor: { include: { user: { select: { name: true } } } } },
                },
                medicalRecords: {
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
            },
        });
        if (!patient) {
            return reply.code(404).send({ error: 'Paciente não encontrado' });
        }
        return decryptPatient(patient);
    });
    // ----- CRIAR -----
    app.post('/patients', async (request, reply) => {
        const parsed = createPatientSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.flatten() });
        }
        try {
            const patient = await prisma2_1.prisma.patient.create({ data: encryptPatient(parsed.data) });
            const uid = request.user?.sub ?? null;
            (0, audit_1.logAudit)({ userId: uid, action: 'CREATE', entity: 'Patient', entityId: patient.id, request });
            return reply.code(201).send(patient);
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                // P2002 = violação de unique constraint
                if (error.code === 'P2002') {
                    return reply.code(409).send({
                        error: 'CPF já cadastrado',
                        field: error.meta?.target,
                    });
                }
            }
            throw error;
        }
    });
    // ----- ATUALIZAR -----
    app.patch('/patients/:id', async (request, reply) => {
        const { id } = request.params;
        const parsed = updatePatientSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.flatten() });
        }
        try {
            const before = await prisma2_1.prisma.patient.findUnique({ where: { id } });
            if (!before)
                return reply.code(404).send({ error: 'Paciente não encontrado' });
            const patient = await prisma2_1.prisma.patient.update({
                where: { id },
                data: encryptPatient(parsed.data),
            });
            const uid = request.user?.sub ?? null;
            (0, audit_1.logAudit)({
                userId: uid, action: 'UPDATE', entity: 'Patient', entityId: patient.id, request,
                before: decryptPatient(before),
                after: decryptPatient(patient),
            });
            return decryptPatient(patient);
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2025') {
                    return reply.code(404).send({ error: 'Paciente não encontrado' });
                }
                if (error.code === 'P2002') {
                    return reply.code(409).send({ error: 'CPF já cadastrado' });
                }
            }
            throw error;
        }
    });
    // ----- UPLOAD DE FOTO -----
    app.patch('/patients/:id/photo', async (request, reply) => {
        const { id } = request.params;
        const existing = await prisma2_1.prisma.patient.findUnique({ where: { id }, select: { id: true } });
        if (!existing)
            return reply.code(404).send({ error: 'Paciente não encontrado' });
        const data = await request.file();
        if (!data)
            return reply.code(400).send({ error: 'Arquivo não enviado' });
        const ext = node_path_1.default.extname(data.filename) || '.jpg';
        const filename = `${Date.now()}-${(0, node_crypto_1.randomUUID)()}${ext}`;
        const dir = node_path_1.default.resolve(process.cwd(), 'uploads', 'patients');
        if (!node_fs_1.default.existsSync(dir))
            node_fs_1.default.mkdirSync(dir, { recursive: true });
        await (0, promises_1.pipeline)(data.file, node_fs_1.default.createWriteStream(node_path_1.default.join(dir, filename)));
        const photoUrl = `/uploads/patients/${filename}`;
        await prisma2_1.prisma.patient.update({ where: { id }, data: { photoUrl } });
        const uid = request.user?.sub ?? null;
        (0, audit_1.logAudit)({ userId: uid, action: 'UPDATE', entity: 'Patient', entityId: id, metadata: { field: 'photoUrl' }, request });
        return { photoUrl };
    });
    // ----- EXCLUIR (anonimização LGPD Art. 18) -----
    // Por que anonimizar em vez de deletar? Prontuários médicos têm retenção legal de 20 anos
    // (CFM 1.821/2007). Anonimizar preserva o histórico clínico sem manter dados pessoais.
    app.delete('/patients/:id', async (request, reply) => {
        const { id } = request.params;
        try {
            const existing = await prisma2_1.prisma.patient.findUnique({ where: { id }, select: { id: true } });
            if (!existing)
                return reply.code(404).send({ error: 'Paciente não encontrado' });
            const anonymizedName = `ANONIMIZADO-${id.slice(-8).toUpperCase()}`;
            await prisma2_1.prisma.patient.update({
                where: { id },
                data: {
                    fullName: anonymizedName,
                    cpf: null,
                    rg: null,
                    email: null,
                    phone: 'ANONIMIZADO',
                    birthDate: null,
                    gender: null,
                    zipCode: null,
                    street: null,
                    number: null,
                    complement: null,
                    neighborhood: null,
                    city: null,
                    state: null,
                    allergies: null,
                    notes: null,
                    healthInsurance: null,
                    healthInsuranceNumber: null,
                    userId: null,
                    deletedAt: new Date(),
                },
            });
            const uid = request.user?.sub ?? null;
            (0, audit_1.logAudit)({
                userId: uid,
                action: 'LGPD_ANONYMIZE',
                entity: 'Patient',
                entityId: id,
                metadata: { reason: 'right_to_erasure_art18' },
                request,
            });
            return reply.send({ message: 'Dados pessoais do paciente anonimizados conforme LGPD Art. 18.' });
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                return reply.code(404).send({ error: 'Paciente não encontrado' });
            }
            throw error;
        }
    });
}
