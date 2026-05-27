"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.leadsRoutes = leadsRoutes;
const prisma2_1 = require("../lib/prisma2");
const auth_1 = require("../plugins/auth");
const crypto_1 = require("../lib/crypto");
const XLSX = __importStar(require("xlsx"));
// Criptografia para campos PII do model Patient (espelha encryptPatient em patients.routes.ts)
function encryptForPatient(data) {
    const d = { ...data };
    if ('cpf' in d && d.cpf)
        d.cpf = (0, crypto_1.encryptDeterministic)(d.cpf);
    if ('phone' in d && d.phone)
        d.phone = (0, crypto_1.encrypt)(d.phone);
    if ('rg' in d && d.rg)
        d.rg = (0, crypto_1.encrypt)(d.rg);
    if ('zipCode' in d && d.zipCode)
        d.zipCode = (0, crypto_1.encrypt)(d.zipCode);
    if ('street' in d && d.street)
        d.street = (0, crypto_1.encrypt)(d.street);
    if ('number' in d && d.number)
        d.number = (0, crypto_1.encrypt)(d.number);
    if ('complement' in d && d.complement)
        d.complement = (0, crypto_1.encrypt)(d.complement);
    if ('neighborhood' in d && d.neighborhood)
        d.neighborhood = (0, crypto_1.encrypt)(d.neighborhood);
    if ('allergies' in d && d.allergies)
        d.allergies = (0, crypto_1.encrypt)(d.allergies);
    if ('notes' in d && d.notes)
        d.notes = (0, crypto_1.encrypt)(d.notes);
    if ('healthInsuranceNumber' in d && d.healthInsuranceNumber)
        d.healthInsuranceNumber = (0, crypto_1.encrypt)(d.healthInsuranceNumber);
    // email NÃO é criptografado no model Patient
    return d;
}
function encryptLead(data) {
    const d = { ...data };
    if ('phone' in d && d.phone)
        d.phone = (0, crypto_1.encrypt)(d.phone);
    if ('email' in d && d.email)
        d.email = (0, crypto_1.encrypt)(d.email);
    if ('cpf' in d && d.cpf)
        d.cpf = (0, crypto_1.encryptDeterministic)(d.cpf);
    if ('allergies' in d && d.allergies)
        d.allergies = (0, crypto_1.encrypt)(d.allergies);
    if ('notes' in d && d.notes)
        d.notes = (0, crypto_1.encrypt)(d.notes);
    return d;
}
function decryptLead(data) {
    const d = { ...data };
    if ('phone' in d && d.phone)
        d.phone = (0, crypto_1.decrypt)(d.phone);
    if ('email' in d && d.email)
        d.email = (0, crypto_1.decrypt)(d.email);
    if ('cpf' in d && d.cpf)
        d.cpf = (0, crypto_1.decryptDeterministic)(d.cpf);
    if ('allergies' in d && d.allergies)
        d.allergies = (0, crypto_1.decrypt)(d.allergies);
    if ('notes' in d && d.notes)
        d.notes = (0, crypto_1.decrypt)(d.notes);
    return d;
}
async function leadsRoutes(app) {
    // ── Listar leads ────────────────────────────────────────────────────────────
    app.get('/leads', { preHandler: (0, auth_1.requireRole)('ADMIN', 'RECEPTIONIST') }, async (request, reply) => {
        const { q, take = '20', skip = '0' } = request.query;
        const takeN = Math.min(Number(take) || 20, 100);
        const skipN = Number(skip) || 0;
        const where = q
            ? { OR: [{ name: { contains: q, mode: 'insensitive' } }] }
            : {};
        const [data, total] = await Promise.all([
            prisma2_1.prisma.lead.findMany({ where, take: takeN, skip: skipN, orderBy: { createdAt: 'desc' } }),
            prisma2_1.prisma.lead.count({ where }),
        ]);
        return reply.send({ data: data.map(l => decryptLead(l)), total, take: takeN, skip: skipN });
    });
    // ── Excluir lead ────────────────────────────────────────────────────────────
    app.delete('/leads/:id', { preHandler: (0, auth_1.requireRole)('ADMIN', 'RECEPTIONIST') }, async (request, reply) => {
        const { id } = request.params;
        await prisma2_1.prisma.lead.delete({ where: { id } });
        return reply.code(204).send();
    });
    // ── Converter lead em paciente ──────────────────────────────────────────────
    app.post('/leads/:id/convert', { preHandler: (0, auth_1.requireRole)('ADMIN', 'RECEPTIONIST') }, async (request, reply) => {
        const { id } = request.params;
        const body = request.body;
        const lead = await prisma2_1.prisma.lead.findUnique({ where: { id } });
        if (!lead)
            return reply.code(404).send({ error: 'Lead não encontrado' });
        if (!body.fullName || !body.cpf || !body.birthDate || !body.gender || !body.phone || !body.email) {
            return reply.code(400).send({ error: 'Preencha todos os campos obrigatórios: Nome, CPF, Data de Nascimento, Gênero, Telefone e E-mail' });
        }
        const patientData = encryptForPatient({
            fullName: String(body.fullName),
            cpf: String(body.cpf),
            birthDate: new Date(String(body.birthDate)),
            gender: String(body.gender),
            phone: String(body.phone),
            email: String(body.email),
            rg: body.rg ? String(body.rg) : undefined,
            zipCode: body.zipCode ? String(body.zipCode) : undefined,
            street: body.street ? String(body.street) : undefined,
            number: body.number ? String(body.number) : undefined,
            complement: body.complement ? String(body.complement) : undefined,
            neighborhood: body.neighborhood ? String(body.neighborhood) : undefined,
            city: body.city ? String(body.city) : undefined,
            state: body.state ? String(body.state) : undefined,
            bloodType: body.bloodType ? String(body.bloodType) : undefined,
            allergies: body.allergies ? String(body.allergies) : undefined,
            notes: body.notes ? String(body.notes) : undefined,
            healthInsurance: body.healthInsurance ? String(body.healthInsurance) : undefined,
            healthInsuranceNumber: body.healthInsuranceNumber ? String(body.healthInsuranceNumber) : undefined,
        });
        const [patient] = await prisma2_1.prisma.$transaction([
            prisma2_1.prisma.patient.create({ data: patientData }),
            prisma2_1.prisma.lead.delete({ where: { id } }),
        ]);
        return reply.code(201).send(patient);
    });
    // ── Importação em massa (Excel → Leads) ─────────────────────────────────────
    app.post('/leads/bulk-import', { preHandler: (0, auth_1.requireRole)('ADMIN', 'RECEPTIONIST') }, async (request, reply) => {
        const data = await request.file();
        if (!data)
            return reply.code(400).send({ error: 'Arquivo não enviado' });
        const buffer = await data.toBuffer();
        let jsonData = [];
        try {
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            jsonData = XLSX.utils.sheet_to_json(worksheet);
        }
        catch {
            return reply.code(400).send({ error: 'Não foi possível ler o arquivo. Certifique-se de que é um arquivo Excel (.xlsx ou .xls) válido.' });
        }
        if (jsonData.length === 0) {
            return reply.code(400).send({ error: 'Arquivo vazio ou sem dados válidos' });
        }
        const errors = [];
        const rawRows = [];
        const genderMap = {
            Masculino: 'MALE', Feminino: 'FEMALE', Outro: 'OTHER',
            MALE: 'MALE', FEMALE: 'FEMALE', OTHER: 'OTHER',
        };
        jsonData.forEach((row, index) => {
            const name = String(row['Nome Completo'] || row['name'] || '').trim();
            const phone = String(row['Telefone'] || row['phone'] || '').trim();
            if (!name && !phone)
                return;
            if (!name || !phone) {
                const missing = [!name && 'Nome Completo', !phone && 'Telefone'].filter(Boolean).join(', ');
                errors.push(`Linha ${index + 2}: campo(s) obrigatório(s) faltando — ${missing}`);
                return;
            }
            const rawDate = row['Data de Nascimento'] || row['birthDate'];
            let birthDate;
            if (rawDate) {
                if (typeof rawDate === 'number') {
                    const parsed = XLSX.SSF.parse_date_code(rawDate);
                    birthDate = new Date(parsed.y, parsed.m - 1, parsed.d);
                }
                else {
                    const d = new Date(String(rawDate));
                    if (!isNaN(d.getTime()))
                        birthDate = d;
                }
            }
            rawRows.push({
                lineNum: index + 2,
                name,
                phone,
                cpf: String(row['CPF'] || row['cpf'] || '').trim() || undefined,
                rg: String(row['RG'] || row['rg'] || '').trim() || undefined,
                birthDate,
                gender: genderMap[row['Gênero'] || row['gender']] || undefined,
                email: String(row['Email'] || row['email'] || '').trim() || undefined,
                zipCode: String(row['CEP'] || row['zipCode'] || '').trim() || undefined,
                street: String(row['Rua'] || row['street'] || '').trim() || undefined,
                number: String(row['Número'] || row['number'] || '').trim() || undefined,
                complement: String(row['Complemento'] || row['complement'] || '').trim() || undefined,
                neighborhood: String(row['Bairro'] || row['neighborhood'] || '').trim() || undefined,
                city: String(row['Cidade'] || row['city'] || '').trim() || undefined,
                state: String(row['Estado'] || row['state'] || '').trim() || undefined,
                bloodType: String(row['Tipo Sanguíneo'] || row['bloodType'] || '').trim() || undefined,
                allergies: String(row['Alergias'] || row['allergies'] || '').trim() || undefined,
                notes: String(row['Observações'] || row['notes'] || '').trim() || undefined,
                healthInsurance: String(row['Convênio'] || row['healthInsurance'] || '').trim() || undefined,
                healthInsuranceNumber: String(row['Número do Convênio'] || row['healthInsuranceNumber'] || '').trim() || undefined,
            });
        });
        // ── 2. Cruza com pacientes existentes para evitar duplicatas ─────────────
        const normalize = (p) => p.replace(/\D/g, '');
        // CPF: criptografia determinística → lookup direto no banco
        const cpfsNoArquivo = rawRows.filter(r => r.cpf).map(r => (0, crypto_1.encryptDeterministic)(r.cpf)).filter((x) => x !== null);
        const pacientesPorCpf = cpfsNoArquivo.length > 0
            ? await prisma2_1.prisma.patient.findMany({ where: { cpf: { in: cpfsNoArquivo } }, select: { cpf: true } })
            : [];
        const cpfsExistentes = new Set(pacientesPorCpf.map((p) => p.cpf).filter(Boolean));
        // Telefone: criptografia AES com IV aleatório → descriptografa todos os pacientes
        const todosPacientes = await prisma2_1.prisma.patient.findMany({ select: { phone: true } });
        const telefonesExistentes = new Set(todosPacientes.map((p) => normalize((0, crypto_1.decrypt)(p.phone) ?? '')));
        // ── 3. Filtra duplicatas e monta lista final ──────────────────────────────
        const toCreate = [];
        for (const row of rawRows) {
            const cpfEnc = row.cpf ? (0, crypto_1.encryptDeterministic)(row.cpf) : null;
            if (cpfEnc && cpfsExistentes.has(cpfEnc)) {
                errors.push(`Linha ${row.lineNum}: ${row.name} — CPF já cadastrado como paciente (ignorado)`);
                continue;
            }
            if (telefonesExistentes.has(normalize(row.phone))) {
                errors.push(`Linha ${row.lineNum}: ${row.name} — telefone já cadastrado como paciente (ignorado)`);
                continue;
            }
            toCreate.push(encryptLead({ ...row, status: 'NOVO' }));
        }
        if (toCreate.length === 0) {
            return reply.code(400).send({
                error: errors.length > 0
                    ? `Nenhuma linha válida encontrada. Erros:\n${errors.join('\n')}`
                    : 'Arquivo sem dados válidos',
            });
        }
        try {
            await prisma2_1.prisma.lead.createMany({ data: toCreate });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return reply.code(500).send({ error: `Erro ao salvar no banco: ${msg}` });
        }
        const message = errors.length > 0
            ? `${toCreate.length} lead(s) importado(s). ${errors.length} linha(s) ignorada(s) por erro:\n${errors.join('\n')}`
            : `${toCreate.length} lead(s) importado(s) com sucesso`;
        return reply.code(201).send({ message, count: toCreate.length });
    });
}
