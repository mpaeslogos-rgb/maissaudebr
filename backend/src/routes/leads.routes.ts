import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma2'
import { requireRole } from '../plugins/auth'
import { encrypt, encryptDeterministic, decrypt, decryptDeterministic } from '../lib/crypto'
import * as XLSX from 'xlsx'

function encryptLead<T extends Record<string, unknown>>(data: T): T {
  const d = { ...data } as Record<string, unknown>
  if ('phone'     in d && d.phone)     d.phone     = encrypt(d.phone as string)
  if ('email'     in d && d.email)     d.email     = encrypt(d.email as string)
  if ('cpf'       in d && d.cpf)       d.cpf       = encryptDeterministic(d.cpf as string)
  if ('allergies' in d && d.allergies) d.allergies = encrypt(d.allergies as string)
  if ('notes'     in d && d.notes)     d.notes     = encrypt(d.notes as string)
  return d as T
}

function decryptLead<T extends Record<string, unknown>>(data: T): T {
  const d = { ...data } as Record<string, unknown>
  if ('phone'     in d && d.phone)     d.phone     = decrypt(d.phone as string)
  if ('email'     in d && d.email)     d.email     = decrypt(d.email as string)
  if ('cpf'       in d && d.cpf)       d.cpf       = decryptDeterministic(d.cpf as string)
  if ('allergies' in d && d.allergies) d.allergies = decrypt(d.allergies as string)
  if ('notes'     in d && d.notes)     d.notes     = decrypt(d.notes as string)
  return d as T
}

export async function leadsRoutes(app: FastifyInstance) {
  // ── Listar leads ────────────────────────────────────────────────────────────
  app.get('/leads', { preHandler: requireRole('ADMIN', 'RECEPTIONIST') }, async (request, reply) => {
    const { q, take = '20', skip = '0' } = request.query as Record<string, string>
    const takeN = Math.min(Number(take) || 20, 100)
    const skipN = Number(skip) || 0

    const where = q
      ? { OR: [{ name: { contains: q, mode: 'insensitive' as const } }] }
      : {}

    const [data, total] = await Promise.all([
      prisma.lead.findMany({ where, take: takeN, skip: skipN, orderBy: { createdAt: 'desc' } }),
      prisma.lead.count({ where }),
    ])

    return reply.send({ data: data.map(l => decryptLead(l as Record<string, unknown>)), total, take: takeN, skip: skipN })
  })

  // ── Excluir lead ────────────────────────────────────────────────────────────
  app.delete('/leads/:id', { preHandler: requireRole('ADMIN', 'RECEPTIONIST') }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await prisma.lead.delete({ where: { id } })
    return reply.code(204).send()
  })

  // ── Converter lead em paciente ──────────────────────────────────────────────
  app.post('/leads/:id/convert', { preHandler: requireRole('ADMIN', 'RECEPTIONIST') }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as Record<string, unknown>

    const lead = await prisma.lead.findUnique({ where: { id } })
    if (!lead) return reply.code(404).send({ error: 'Lead não encontrado' })

    if (!body.fullName || !body.cpf || !body.birthDate || !body.gender || !body.phone || !body.email) {
      return reply.code(400).send({ error: 'Preencha todos os campos obrigatórios: Nome, CPF, Data de Nascimento, Gênero, Telefone e E-mail' })
    }

    const patientData = encryptLead({
      fullName:             String(body.fullName),
      cpf:                  String(body.cpf),
      birthDate:            new Date(String(body.birthDate)),
      gender:               String(body.gender),
      phone:                String(body.phone),
      email:                String(body.email),
      rg:                   body.rg ? String(body.rg) : undefined,
      zipCode:              body.zipCode ? String(body.zipCode) : undefined,
      street:               body.street ? String(body.street) : undefined,
      number:               body.number ? String(body.number) : undefined,
      complement:           body.complement ? String(body.complement) : undefined,
      neighborhood:         body.neighborhood ? String(body.neighborhood) : undefined,
      city:                 body.city ? String(body.city) : undefined,
      state:                body.state ? String(body.state) : undefined,
      bloodType:            body.bloodType ? String(body.bloodType) : undefined,
      allergies:            body.allergies ? String(body.allergies) : undefined,
      notes:                body.notes ? String(body.notes) : undefined,
      healthInsurance:      body.healthInsurance ? String(body.healthInsurance) : undefined,
      healthInsuranceNumber: body.healthInsuranceNumber ? String(body.healthInsuranceNumber) : undefined,
    })

    const [patient] = await prisma.$transaction([
      prisma.patient.create({ data: patientData as any }),
      prisma.lead.delete({ where: { id } }),
    ])

    return reply.code(201).send(patient)
  })

  // ── Importação em massa (Excel → Leads) ─────────────────────────────────────
  app.post('/leads/bulk-import', { preHandler: requireRole('ADMIN', 'RECEPTIONIST') }, async (request, reply) => {
    const data = await request.file()
    if (!data) return reply.code(400).send({ error: 'Arquivo não enviado' })

    const buffer = await data.toBuffer()

    let jsonData: unknown[]
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      jsonData = XLSX.utils.sheet_to_json(worksheet)
    } catch {
      return reply.code(400).send({ error: 'Não foi possível ler o arquivo. Certifique-se de que é um arquivo Excel (.xlsx ou .xls) válido.' })
    }

    if (jsonData.length === 0) {
      return reply.code(400).send({ error: 'Arquivo vazio ou sem dados válidos' })
    }

    const toCreate: any[] = []
    const errors: string[] = []

    jsonData.forEach((row: any, index: number) => {
      const name  = String(row['Nome Completo'] || row['name'] || '').trim()
      const phone = String(row['Telefone'] || row['phone'] || '').trim()

      // Ignora linhas totalmente em branco (trailing rows do Excel)
      if (!name && !phone) return

      if (!name || !phone) {
        const missing = [!name && 'Nome Completo', !phone && 'Telefone'].filter(Boolean).join(', ')
        errors.push(`Linha ${index + 2}: campo(s) obrigatório(s) faltando — ${missing}`)
        return
      }

      const genderMap: Record<string, string> = {
        Masculino: 'MALE', Feminino: 'FEMALE', Outro: 'OTHER',
        MALE: 'MALE', FEMALE: 'FEMALE', OTHER: 'OTHER',
      }

      const rawDate = row['Data de Nascimento'] || row['birthDate']
      let birthDate: Date | undefined
      if (rawDate) {
        if (typeof rawDate === 'number') {
          // Número serial do Excel
          birthDate = XLSX.SSF.parse_date_code(rawDate) as unknown as Date
          const parsed = XLSX.SSF.parse_date_code(rawDate)
          birthDate = new Date(parsed.y, parsed.m - 1, parsed.d)
        } else {
          const d = new Date(String(rawDate))
          if (!isNaN(d.getTime())) birthDate = d
        }
      }

      const rawCpf = String(row['CPF'] || row['cpf'] || '').trim()

      toCreate.push(encryptLead({
        name,
        phone,
        cpf:                  rawCpf || undefined,
        rg:                   String(row['RG'] || row['rg'] || '').trim() || undefined,
        birthDate:            birthDate,
        gender:               genderMap[row['Gênero'] || row['gender']] || undefined,
        email:                String(row['Email'] || row['email'] || '').trim() || undefined,
        zipCode:              String(row['CEP'] || row['zipCode'] || '').trim() || undefined,
        street:               String(row['Rua'] || row['street'] || '').trim() || undefined,
        number:               String(row['Número'] || row['number'] || '').trim() || undefined,
        complement:           String(row['Complemento'] || row['complement'] || '').trim() || undefined,
        neighborhood:         String(row['Bairro'] || row['neighborhood'] || '').trim() || undefined,
        city:                 String(row['Cidade'] || row['city'] || '').trim() || undefined,
        state:                String(row['Estado'] || row['state'] || '').trim() || undefined,
        bloodType:            String(row['Tipo Sanguíneo'] || row['bloodType'] || '').trim() || undefined,
        allergies:            String(row['Alergias'] || row['allergies'] || '').trim() || undefined,
        notes:                String(row['Observações'] || row['notes'] || '').trim() || undefined,
        healthInsurance:      String(row['Convênio'] || row['healthInsurance'] || '').trim() || undefined,
        healthInsuranceNumber: String(row['Número do Convênio'] || row['healthInsuranceNumber'] || '').trim() || undefined,
        status: 'NOVO',
      }))
    })

    if (toCreate.length === 0) {
      return reply.code(400).send({
        error: errors.length > 0
          ? `Nenhuma linha válida encontrada. Erros:\n${errors.join('\n')}`
          : 'Arquivo sem dados válidos',
      })
    }

    try {
      await prisma.lead.createMany({ data: toCreate })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.code(500).send({ error: `Erro ao salvar no banco: ${msg}` })
    }

    const message = errors.length > 0
      ? `${toCreate.length} lead(s) importado(s). ${errors.length} linha(s) ignorada(s) por erro:\n${errors.join('\n')}`
      : `${toCreate.length} lead(s) importado(s) com sucesso`

    return reply.code(201).send({ message, count: toCreate.length })
  })
}
