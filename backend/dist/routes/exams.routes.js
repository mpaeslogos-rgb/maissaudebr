"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.examsRoutes = examsRoutes;
const zod_1 = require("zod");
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_crypto_1 = require("node:crypto");
const auth_1 = require("../plugins/auth");
const prisma2_1 = require("../lib/prisma2");
const audit_1 = require("../lib/audit");
const ALLOWED_MIME = new Set([
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'application/pdf',
]);
const examQuerySchema = zod_1.z.object({
    patientId: zod_1.z.string().optional(),
    medicalRecordId: zod_1.z.string().optional(),
    take: zod_1.z.coerce.number().int().min(1).max(100).default(50),
    skip: zod_1.z.coerce.number().int().min(0).default(0),
});
async function examsRoutes(app) {
    app.addHook('preHandler', (0, auth_1.requireRole)('ADMIN', 'DOCTOR'));
    // GET /api/exams?patientId=&medicalRecordId=
    app.get('/exams', async (request, reply) => {
        const parsed = examQuerySchema.safeParse(request.query);
        if (!parsed.success)
            return reply.code(400).send({ error: parsed.error.flatten() });
        const { patientId, medicalRecordId, take, skip } = parsed.data;
        const [data, total] = await Promise.all([
            prisma2_1.prisma.exam.findMany({
                where: {
                    ...(patientId ? { patientId } : {}),
                    ...(medicalRecordId ? { medicalRecordId } : {}),
                },
                orderBy: { createdAt: 'desc' },
                take,
                skip,
            }),
            prisma2_1.prisma.exam.count({
                where: {
                    ...(patientId ? { patientId } : {}),
                    ...(medicalRecordId ? { medicalRecordId } : {}),
                },
            }),
        ]);
        return reply.send({ data, total });
    });
    // POST /api/exams — upload de arquivo + metadados
    app.post('/exams', async (request, reply) => {
        const data = await request.file();
        if (!data)
            return reply.code(400).send({ error: 'Nenhum arquivo enviado.' });
        const { patientId, medicalRecordId, name, type, notes, examDate } = Object.fromEntries(Object.entries(data.fields).map(([k, v]) => [k, v.value]));
        if (!patientId)
            return reply.code(400).send({ error: 'patientId obrigatório.' });
        if (!name)
            return reply.code(400).send({ error: 'name obrigatório.' });
        const mime = data.mimetype;
        if (!ALLOWED_MIME.has(mime)) {
            return reply.code(415).send({ error: 'Tipo de arquivo não suportado. Use imagem (JPEG, PNG, WebP) ou PDF.' });
        }
        const ext = node_path_1.default.extname(data.filename) || (mime === 'application/pdf' ? '.pdf' : '.jpg');
        const fname = `${Date.now()}-${(0, node_crypto_1.randomUUID)()}${ext}`;
        const dir = node_path_1.default.resolve(process.cwd(), 'uploads', 'exams');
        const fpath = node_path_1.default.join(dir, fname);
        if (!node_fs_1.default.existsSync(dir))
            node_fs_1.default.mkdirSync(dir, { recursive: true });
        const chunks = [];
        for await (const chunk of data.file)
            chunks.push(chunk);
        const buf = Buffer.concat(chunks);
        node_fs_1.default.writeFileSync(fpath, buf);
        const fileUrl = `/uploads/exams/${fname}`;
        const validTypes = ['LABORATORY', 'IMAGING', 'REPORT', 'OTHER'];
        const examType = validTypes.includes(type)
            ? type
            : 'OTHER';
        const exam = await prisma2_1.prisma.exam.create({
            data: {
                patientId,
                medicalRecordId: medicalRecordId || null,
                name,
                type: examType,
                fileUrl,
                fileName: data.filename,
                fileSize: buf.length,
                mimeType: mime,
                notes: notes || null,
                examDate: examDate ? new Date(examDate) : null,
            },
        });
        const uid = request.user?.sub ?? null;
        (0, audit_1.logAudit)({ userId: uid, action: 'CREATE_EXAM', entity: 'Exam', entityId: exam.id, request });
        return reply.code(201).send(exam);
    });
    // DELETE /api/exams/:id
    app.delete('/exams/:id', async (request, reply) => {
        const { id } = request.params;
        const exam = await prisma2_1.prisma.exam.findUnique({ where: { id } });
        if (!exam)
            return reply.code(404).send({ error: 'Exame não encontrado.' });
        // Remove arquivo do disco
        if (exam.fileUrl) {
            const fpath = node_path_1.default.resolve(process.cwd(), exam.fileUrl.replace(/^\//, ''));
            if (node_fs_1.default.existsSync(fpath))
                node_fs_1.default.unlinkSync(fpath);
        }
        await prisma2_1.prisma.exam.delete({ where: { id } });
        const uid = request.user?.sub ?? null;
        (0, audit_1.logAudit)({ userId: uid, action: 'DELETE_EXAM', entity: 'Exam', entityId: id, request });
        return reply.code(204).send();
    });
}
