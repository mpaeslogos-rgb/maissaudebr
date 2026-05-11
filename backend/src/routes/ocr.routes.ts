// src/routes/ocr.routes.ts
// ─────────────────────────────────────────────────────────────────────────────
// OCR de exames médicos via OpenAI Vision
//
// Endpoints:
//   POST /ocr/analyze              → analisa imagem, NÃO persiste (preview)
//   POST /ocr/medical-records      → analisa + cria novo MedicalRecord
//   POST /ocr/medical-records/:id  → analisa + anexa em MedicalRecord existente
//
// Storage: local em uploads/ocr/  servido via @fastify/static em /uploads
// Modelo:  OPENAI_VISION_MODEL (env) com fallback para gpt-4o-mini
// Sincronia: síncrona (request aguarda resposta da OpenAI)
// ─────────────────────────────────────────────────────────────────────────────

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { pipeline } from 'node:stream/promises'
import { createWriteStream } from 'node:fs'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'
import OpenAI from 'openai'
import { prisma } from '../lib/prisma2'
import { authenticate } from '../plugins/auth'
import { extractUniqueViolationFields } from '../lib/prisma-errors'
import { Prisma } from '@prisma/client'

// ─── Constantes ──────────────────────────────────────────────────────────────

// Pasta raiz onde as imagens são salvas (relativa ao processo, ou seja, backend/)
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'ocr')

// Tipos MIME aceitos — apenas imagens comuns de exames
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]

// Limite de tamanho: 10 MB (já configurado no @fastify/multipart global,
// mas validamos também aqui para retornar mensagem clara ao usuário)
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

// Modelo OpenAI configurável via env
const VISION_MODEL = process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini'

// ─── Cliente OpenAI ───────────────────────────────────────────────────────────
// A SDK lê OPENAI_API_KEY automaticamente do process.env
const openai = new OpenAI()

// ─── Schema Zod para parâmetro :id (rota de anexar) ─────────────────────────
const paramIdSchema = z.object({
  id: z.string().min(1, 'ID obrigatório'),
})

// ─── Helpers internos ─────────────────────────────────────────────────────────

/**
 * Garante que a pasta uploads/ocr existe em runtime.
 * Necessário porque o Git não commita pastas vazias.
 */
function ensureUploadsDir(): void {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true })
  }
}

/**
 * Salva o stream multipart em disco e retorna:
 * - filePath: caminho absoluto no disco
 * - publicUrl: URL pública servida pelo @fastify/static
 * - mimeType: tipo MIME detectado no upload
 * - fileSize: tamanho em bytes
 *
 * Lança Error com mensagem legível para:
 * - nenhum arquivo enviado
 * - mime type inválido
 * - arquivo maior que 10 MB
 */
async function saveUploadedFile(request: FastifyRequest): Promise<{
  filePath: string
  publicUrl: string
  mimeType: string
  fileSize: number
}> {
  // @fastify/multipart expõe file() para ler o primeiro arquivo
  const data = await request.file()

  if (!data) {
    throw new Error('Nenhum arquivo enviado. Envie uma imagem no campo "file".')
  }

  const mimeType = data.mimetype

  // Validar tipo MIME antes de salvar no disco
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    // Consumir o stream para não deixar conexão pendurada
    data.file.resume()
    throw new Error(
      `Tipo de arquivo não suportado: "${mimeType}". ` +
        `Aceitos: ${ALLOWED_MIME_TYPES.join(', ')}`
    )
  }

  ensureUploadsDir()

  // Nome único: timestamp + UUID para evitar colisão de nomes
  const ext = path.extname(data.filename) || '.jpg'
  const uniqueFileName = `${Date.now()}-${randomUUID()}${ext}`
  const filePath = path.join(UPLOADS_DIR, uniqueFileName)

  // Contar bytes enquanto salva para validar tamanho
  let fileSize = 0
  const writeStream = createWriteStream(filePath)

  // Interceptar chunks para contar tamanho
  data.file.on('data', (chunk: Buffer) => {
    fileSize += chunk.length
  })

  await pipeline(data.file, writeStream)

  // Validar tamanho DEPOIS de salvar (multipart já leu o stream)
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    // Apagar arquivo inválido do disco
    fs.unlinkSync(filePath)
    throw new Error(
      `Arquivo muito grande: ${(fileSize / 1024 / 1024).toFixed(2)} MB. ` +
        `Limite: 10 MB.`
    )
  }

  // fileSize === 0 significa que o campo "file" veio vazio
  if (fileSize === 0) {
    fs.unlinkSync(filePath)
    throw new Error('Arquivo enviado está vazio.')
  }

  // URL pública — servida pelo @fastify/static mapeado em /uploads
  const publicUrl = `/uploads/ocr/${uniqueFileName}`

  return { filePath, publicUrl, mimeType, fileSize }
}

/**
 * Converte a imagem salva em Base64 e chama a OpenAI Vision API.
 * Retorna { ocrText, ocrSummary } prontos para salvar no MedicalRecord.
 *
 * Por quê Base64 e não URL pública?
 * Porque em desenvolvimento o servidor não tem URL pública acessível
 * pela OpenAI. Base64 funciona offline e em localhost.
 */
async function analyzeImageWithOpenAI(filePath: string): Promise<{
  ocrText: string
  ocrSummary: string
}> {
  // Ler arquivo do disco e converter para base64
  const imageBuffer = fs.readFileSync(filePath)
  const base64Image = imageBuffer.toString('base64')

  // Detectar mime type pela extensão do arquivo
  const ext = path.extname(filePath).toLowerCase()
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  }
  const imageMime = mimeMap[ext] || 'image/jpeg'
  const dataUrl = `data:${imageMime};base64,${base64Image}`

  // ── Chamada 1: extrair texto bruto (OCR) ──────────────────────────────────
  const ocrResponse = await openai.chat.completions.create({
    model: VISION_MODEL,
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: dataUrl, detail: 'high' },
          },
          {
            type: 'text',
            text:
              'Você é um assistente médico especializado em leitura de exames. ' +
              'Extraia TODO o texto visível nesta imagem de exame médico, ' +
              'preservando a estrutura original (títulos, valores, unidades, ' +
              'datas, nome do paciente se houver). ' +
              'Retorne APENAS o texto extraído, sem comentários adicionais.',
          },
        ],
      },
    ],
  })

  const ocrText =
    ocrResponse.choices[0]?.message?.content?.trim() ||
    'Não foi possível extrair texto da imagem.'

  // ── Chamada 2: gerar resumo clínico ───────────────────────────────────────
  const summaryResponse = await openai.chat.completions.create({
    model: VISION_MODEL,
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content:
          'Você é um assistente médico. Com base no texto de exame abaixo, ' +
          'gere um resumo clínico objetivo em português, destacando: ' +
          '(1) tipo de exame, (2) achados principais, (3) valores alterados ' +
          '(se houver), (4) observações relevantes para o médico. ' +
          'Seja conciso (máximo 150 palavras). Não faça diagnóstico.\n\n' +
          `TEXTO DO EXAME:\n${ocrText}`,
      },
    ],
  })

  const ocrSummary =
    summaryResponse.choices[0]?.message?.content?.trim() ||
    'Não foi possível gerar resumo do exame.'

  return { ocrText, ocrSummary }
}

// ─── Plugin principal de rotas ────────────────────────────────────────────────

export async function ocrRoutes(app: FastifyInstance) {

  // ══════════════════════════════════════════════════════════════════════════
  // POST /ocr/analyze
  // Preview: analisa a imagem e retorna ocrText + ocrSummary
  // NÃO cria nem atualiza MedicalRecord
  // Útil para o frontend mostrar o resultado antes de confirmar
  // ══════════════════════════════════════════════════════════════════════════
  app.post(
    '/ocr/analyze',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      let savedFilePath: string | null = null

      try {
        // 1. Salvar imagem temporariamente no disco
        const { filePath, publicUrl, mimeType, fileSize } =
          await saveUploadedFile(request)
        savedFilePath = filePath

        // 2. Chamar OpenAI Vision
        const { ocrText, ocrSummary } = await analyzeImageWithOpenAI(filePath)

        // 3. Retornar resultado — NÃO persiste nada no banco
        return reply.status(200).send({
          message: 'Análise OCR concluída (preview — não salvo no prontuário)',
          model: VISION_MODEL,
          file: {
            url: publicUrl,
            mimeType,
            sizeBytes: fileSize,
          },
          ocr: {
            text: ocrText,
            summary: ocrSummary,
          },
        })
      } catch (err: unknown) {
        // Apagar arquivo do disco se análise falhou
        if (savedFilePath && fs.existsSync(savedFilePath)) {
          fs.unlinkSync(savedFilePath)
        }

        if (err instanceof Error) {
          // Erros de validação de arquivo → 400
          return reply.status(400).send({ error: err.message })
        }

        throw err // outros erros → Fastify trata como 500
      }
    }
  )

  // ══════════════════════════════════════════════════════════════════════════
  // POST /ocr/medical-records
  // Analisa imagem + cria novo MedicalRecord com ocrText e ocrSummary
  // Body multipart pode conter campos extras: patientId, doctorId,
  // appointmentId (todos opcionais, mas patientId e doctorId são
  // obrigatórios para criar um prontuário válido no Prisma)
  // ══════════════════════════════════════════════════════════════════════════

  // Schema dos campos do formulário multipart (além do arquivo)
  const createMedicalRecordSchema = z.object({
    patientId: z.string().min(1, 'patientId obrigatório'),
    doctorId: z.string().min(1, 'doctorId obrigatório'),
    appointmentId: z.string().min(1).optional(),
    chiefComplaint: z.string().min(1).optional(),
    observations: z.string().min(1).optional(),
  })

  app.post(
    '/ocr/medical-records',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      let savedFilePath: string | null = null

      try {
        // 1. Salvar imagem no disco
        const { filePath, publicUrl, mimeType, fileSize } =
          await saveUploadedFile(request)
        savedFilePath = filePath

        // 2. Ler campos do formulário multipart
        // @fastify/multipart expõe os campos em request.body após file()
        // Mas como usamos file() (não fields()), precisamos ler body manualmente
        // NOTA: quando @fastify/multipart está registrado, request.body
        // contém os campos NÃO-arquivo como strings no modo padrão.
        // Porém, com file(), os campos ficam no objeto "data" — então
        // vamos buscar do body depois que o stream foi consumido.
        const rawBody = request.body as Record<string, unknown>

        const parsed = createMedicalRecordSchema.safeParse({
          patientId: rawBody?.patientId,
          doctorId: rawBody?.doctorId,
          appointmentId: rawBody?.appointmentId || undefined,
          chiefComplaint: rawBody?.chiefComplaint || undefined,
          observations: rawBody?.observations || undefined,
        })

        if (!parsed.success) {
          // Apagar arquivo se dados inválidos
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
          return reply.status(400).send({
            error: 'Dados inválidos',
            details: parsed.error.flatten(),
          })
        }

        const { patientId, doctorId, appointmentId, chiefComplaint, observations } =
          parsed.data

        // 3. Verificar se Patient existe
        const patient = await prisma.patient.findUnique({
          where: { id: patientId },
          select: { id: true },
        })
        if (!patient) {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
          return reply.status(404).send({ error: 'Paciente não encontrado' })
        }

        // 4. Verificar se Doctor existe
        const doctor = await prisma.doctor.findUnique({
          where: { id: doctorId },
          select: { id: true },
        })
        if (!doctor) {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
          return reply.status(404).send({ error: 'Médico não encontrado' })
        }

        // 5. Chamar OpenAI Vision
        const { ocrText, ocrSummary } = await analyzeImageWithOpenAI(filePath)

        // 6. Criar MedicalRecord com resultado OCR
        const medicalRecord = await prisma.medicalRecord.create({
          data: {
            patientId,
            doctorId,
            ...(appointmentId ? { appointmentId } : {}),
            ...(chiefComplaint ? { chiefComplaint } : {}),
            ...(observations ? { observations } : {}),
            attachmentUrl: publicUrl,
            ocrText,
            ocrSummary,
          },
          select: {
            id: true,
            patientId: true,
            doctorId: true,
            appointmentId: true,
            chiefComplaint: true,
            observations: true,
            attachmentUrl: true,
            ocrText: true,
            ocrSummary: true,
            createdAt: true,
            patient: { select: { fullName: true } },
            doctor: { select: { crm: true, specialty: true } },
          },
        })

        return reply.status(201).send({
          message: 'Prontuário criado com OCR do exame',
          model: VISION_MODEL,
          file: {
            url: publicUrl,
            mimeType,
            sizeBytes: fileSize,
          },
          medicalRecord,
        })
      } catch (err: unknown) {
        if (savedFilePath && fs.existsSync(savedFilePath)) {
          fs.unlinkSync(savedFilePath)
        }

        if (err instanceof Prisma.PrismaClientKnownRequestError) {
          if (err.code === 'P2002') {
            const fields = extractUniqueViolationFields(err)
            return reply.status(409).send({
              error: 'Conflito: já existe prontuário com esses dados únicos',
              fields,
            })
          }
          if (err.code === 'P2025') {
            return reply.status(404).send({
              error: 'Registro relacionado não encontrado',
            })
          }
        }

        if (err instanceof Error) {
          return reply.status(400).send({ error: err.message })
        }

        throw err
      }
    }
  )

  // ══════════════════════════════════════════════════════════════════════════
  // POST /ocr/medical-records/:id
  // Analisa imagem + ANEXA resultado em MedicalRecord existente
  // Atualiza: attachmentUrl, ocrText, ocrSummary
  // Segue a mesma lógica do /:id/attach-ocr já existente,
  // mas agora aceita upload de imagem real (não apenas URL)
  // ══════════════════════════════════════════════════════════════════════════
  app.post(
    '/ocr/medical-records/:id',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      let savedFilePath: string | null = null

      try {
        // 1. Validar :id
        const paramParsed = paramIdSchema.safeParse(request.params)
        if (!paramParsed.success) {
          return reply.status(400).send({
            error: 'Parâmetro inválido',
            details: paramParsed.error.flatten(),
          })
        }
        const { id } = paramParsed.data

        // 2. Verificar se MedicalRecord existe
        const existing = await prisma.medicalRecord.findUnique({
          where: { id },
          select: { id: true, attachmentUrl: true },
        })
        if (!existing) {
          return reply.status(404).send({ error: 'Prontuário não encontrado' })
        }

        // 3. Salvar nova imagem no disco
        const { filePath, publicUrl, mimeType, fileSize } =
          await saveUploadedFile(request)
        savedFilePath = filePath

        // 4. Apagar imagem anterior do disco (se era local)
        if (existing.attachmentUrl?.startsWith('/uploads/')) {
          const oldFilePath = path.resolve(
            process.cwd(),
            existing.attachmentUrl.slice(1) // remove "/" inicial
          )
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath)
          }
        }

        // 5. Chamar OpenAI Vision
        const { ocrText, ocrSummary } = await analyzeImageWithOpenAI(filePath)

        // 6. Atualizar MedicalRecord
        const updated = await prisma.medicalRecord.update({
          where: { id },
          data: {
            attachmentUrl: publicUrl,
            ocrText,
            ocrSummary,
          },
          select: {
            id: true,
            patientId: true,
            doctorId: true,
            appointmentId: true,
            attachmentUrl: true,
            ocrText: true,
            ocrSummary: true,
            updatedAt: true,
            patient: { select: { fullName: true } },
            doctor: { select: { crm: true, specialty: true } },
          },
        })

        return reply.status(200).send({
          message: 'OCR do exame anexado ao prontuário existente',
          model: VISION_MODEL,
          file: {
            url: publicUrl,
            mimeType,
            sizeBytes: fileSize,
          },
          medicalRecord: updated,
        })
      } catch (err: unknown) {
        if (savedFilePath && fs.existsSync(savedFilePath)) {
          fs.unlinkSync(savedFilePath)
        }

        if (err instanceof Prisma.PrismaClientKnownRequestError) {
          if (err.code === 'P2025') {
            return reply.status(404).send({ error: 'Prontuário não encontrado' })
          }
        }

        if (err instanceof Error) {
          return reply.status(400).send({ error: err.message })
        }

        throw err
      }
    }
  )
}