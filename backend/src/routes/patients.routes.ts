import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { authenticate } from '../plugins/auth'
import * as XLSX from 'xlsx'

// ============================================
// SCHEMAS DE VALIDAÇÃO (Zod)
// ============================================

const createPatientSchema = z.object({
  fullName: z.string().min(2, 'Nome muito curto'),
  cpf: z.string().min(11, 'CPF inválido').max(14),
  rg: z.string().optional(),
  birthDate: z.string().transform((v) => new Date(v)),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  email: z.string().email().optional(),
  phone: z.string().min(8),

  // Endereço (todos opcionais)
  zipCode: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),

  // Dados clínicos
  bloodType: z.string().optional(),
  allergies: z.string().optional(),
  notes: z.string().optional(),

  // Convênio
  healthInsurance: z.string().optional(),
  healthInsuranceNumber: z.string().optional(),
})

const updatePatientSchema = createPatientSchema.partial()

const listQuerySchema = z.object({
  search: z.string().optional(),
  take: z.coerce.number().int().positive().max(100).default(50),
  skip: z.coerce.number().int().nonnegative().default(0),
})

// ============================================
// ROTAS
// ============================================

export async function patientsRoutes(app: FastifyInstance) {
  // Todas as rotas exigem autenticação
  app.addHook('onRequest', authenticate)

  // ----- LISTAR (com busca opcional e paginação) -----
  app.get('/patients', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() })
    }

    const { search, take, skip } = parsed.data

    const where: Prisma.PatientWhereInput = search
      ? {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { cpf: { contains: search } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.patient.count({ where }),
    ])

    return { data: patients, total, take, skip }
  })

  // ----- BUSCAR POR ID -----
  app.get('/patients/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const patient = await prisma.patient.findUnique({
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
    })

    if (!patient) {
      return reply.code(404).send({ error: 'Paciente não encontrado' })
    }

    return patient
  })

  // ----- CRIAR -----
  app.post('/patients', async (request, reply) => {
    const parsed = createPatientSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() })
    }

    try {
      const patient = await prisma.patient.create({ data: parsed.data })
      return reply.code(201).send(patient)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2002 = violação de unique constraint
        if (error.code === 'P2002') {
          return reply.code(409).send({
            error: 'CPF já cadastrado',
            field: error.meta?.target,
          })
        }
      }
      throw error
    }
  })

  // ----- ATUALIZAR -----
  app.patch('/patients/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = updatePatientSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() })
    }

    try {
      const patient = await prisma.patient.update({
        where: { id },
        data: parsed.data,
      })
      return patient
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          return reply.code(404).send({ error: 'Paciente não encontrado' })
        }
        if (error.code === 'P2002') {
          return reply.code(409).send({ error: 'CPF já cadastrado' })
        }
      }
      throw error
    }
  })

  // ----- IMPORTAR EM MASSA (Excel) -----
  app.post('/patients/bulk-import', async (request, reply) => {
    const data = await request.file()
    if (!data) {
      return reply.code(400).send({ error: 'Arquivo não enviado' })
    }

    if (data.mimetype !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' &&
        data.mimetype !== 'application/vnd.ms-excel') {
      return reply.code(400).send({ error: 'Arquivo deve ser Excel (.xlsx ou .xls)' })
    }

    const buffer = await data.toBuffer()
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet)

    if (jsonData.length === 0) {
      return reply.code(400).send({ error: 'Arquivo vazio ou sem dados válidos' })
    }

    // Validar e preparar dados
    const patientsToCreate: any[] = []
    const errors: string[] = []

    jsonData.forEach((row: any, index: number) => {
      try {
        const patientData = {
          fullName: row['Nome Completo'] || row['fullName'],
          cpf: row['CPF'] || row['cpf'],
          rg: row['RG'] || row['rg'],
          birthDate: row['Data de Nascimento'] || row['birthDate'],
          gender: row['Gênero'] || row['gender'],
          email: row['Email'] || row['email'],
          phone: row['Telefone'] || row['phone'],
          zipCode: row['CEP'] || row['zipCode'],
          street: row['Rua'] || row['street'],
          number: row['Número'] || row['number'],
          complement: row['Complemento'] || row['complement'],
          neighborhood: row['Bairro'] || row['neighborhood'],
          city: row['Cidade'] || row['city'],
          state: row['Estado'] || row['state'],
          bloodType: row['Tipo Sanguíneo'] || row['bloodType'],
          allergies: row['Alergias'] || row['allergies'],
          notes: row['Observações'] || row['notes'],
          healthInsurance: row['Convênio'] || row['healthInsurance'],
          healthInsuranceNumber: row['Número do Convênio'] || row['healthInsuranceNumber'],
        }

        // Validar campos obrigatórios
        if (!patientData.fullName || !patientData.cpf || !patientData.birthDate || !patientData.gender || !patientData.phone) {
          errors.push(`Linha ${index + 2}: Campos obrigatórios faltando (Nome, CPF, Data Nascimento, Gênero, Telefone)`)
          return
        }

        // Transformar data
        if (typeof patientData.birthDate === 'string') {
          patientData.birthDate = new Date(patientData.birthDate)
        }

        // Mapear gênero
        const genderMap: { [key: string]: string } = {
          'Masculino': 'MALE',
          'Feminino': 'FEMALE',
          'Outro': 'OTHER',
          'MALE': 'MALE',
          'FEMALE': 'FEMALE',
          'OTHER': 'OTHER'
        }
        patientData.gender = genderMap[patientData.gender] || 'OTHER'

        patientsToCreate.push(patientData)
      } catch (err) {
        errors.push(`Linha ${index + 2}: Erro ao processar dados - ${err}`)
      }
    })

    if (errors.length > 0) {
      return reply.code(400).send({ error: 'Erros na validação dos dados', details: errors })
    }

    try {
      const createdPatients = await prisma.$transaction(
        patientsToCreate.map(patient => prisma.patient.create({ data: patient }))
      )
      return reply.code(201).send({
        message: `${createdPatients.length} pacientes importados com sucesso`,
        data: createdPatients
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          return reply.code(409).send({ error: 'CPF duplicado encontrado' })
        }
      }
      throw error
    }
  })
}