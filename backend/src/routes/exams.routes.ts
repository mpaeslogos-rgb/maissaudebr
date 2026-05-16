import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import path from 'node:path'
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { requireRole } from '../plugins/auth'
import { prisma } from '../lib/prisma2'

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'application/pdf',
])

const examQuerySchema = z.object({
  patientId:       z.string().optional(),
  medicalRecordId: z.string().optional(),
  take:            z.coerce.number().int().min(1).max(100).default(50),
  skip:            z.coerce.number().int().min(0).default(0),
})

export async function examsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('ADMIN', 'DOCTOR'))

  // GET /api/exams?patientId=&medicalRecordId=
  app.get('/exams', async (request, reply) => {
    const parsed = examQuerySchema.safeParse(request.query)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    const { patientId, medicalRecordId, take, skip } = parsed.data

    const [data, total] = await Promise.all([
      prisma.exam.findMany({
        where: {
          ...(patientId       ? { patientId }       : {}),
          ...(medicalRecordId ? { medicalRecordId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.exam.count({
        where: {
          ...(patientId       ? { patientId }       : {}),
          ...(medicalRecordId ? { medicalRecordId } : {}),
        },
      }),
    ])

    return reply.send({ data, total })
  })

  // POST /api/exams — upload de arquivo + metadados
  app.post('/exams', async (request, reply) => {
    const data = await request.file()
    if (!data) return reply.code(400).send({ error: 'Nenhum arquivo enviado.' })

    const { patientId, medicalRecordId, name, type, notes, examDate } =
      Object.fromEntries(
        Object.entries(data.fields).map(([k, v]) => [k, (v as { value: string }).value])
      ) as Record<string, string>

    if (!patientId) return reply.code(400).send({ error: 'patientId obrigatório.' })
    if (!name)      return reply.code(400).send({ error: 'name obrigatório.' })

    const mime = data.mimetype
    if (!ALLOWED_MIME.has(mime)) {
      return reply.code(415).send({ error: 'Tipo de arquivo não suportado. Use imagem (JPEG, PNG, WebP) ou PDF.' })
    }

    const ext     = path.extname(data.filename) || (mime === 'application/pdf' ? '.pdf' : '.jpg')
    const fname   = `${Date.now()}-${randomUUID()}${ext}`
    const dir     = path.resolve(process.cwd(), 'uploads', 'exams')
    const fpath   = path.join(dir, fname)

    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    const chunks: Buffer[] = []
    for await (const chunk of data.file) chunks.push(chunk)
    const buf = Buffer.concat(chunks)
    fs.writeFileSync(fpath, buf)

    const fileUrl = `/uploads/exams/${fname}`

    const validTypes = ['LABORATORY', 'IMAGING', 'REPORT', 'OTHER'] as const
    const examType = validTypes.includes(type as (typeof validTypes)[number])
      ? (type as (typeof validTypes)[number])
      : 'OTHER'

    const exam = await prisma.exam.create({
      data: {
        patientId,
        medicalRecordId: medicalRecordId || null,
        name,
        type:     examType,
        fileUrl,
        fileName: data.filename,
        fileSize: buf.length,
        mimeType: mime,
        notes:    notes || null,
        examDate: examDate ? new Date(examDate) : null,
      },
    })

    return reply.code(201).send(exam)
  })

  // DELETE /api/exams/:id
  app.delete('/exams/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const exam = await prisma.exam.findUnique({ where: { id } })
    if (!exam) return reply.code(404).send({ error: 'Exame não encontrado.' })

    // Remove arquivo do disco
    if (exam.fileUrl) {
      const fpath = path.resolve(process.cwd(), exam.fileUrl.replace(/^\//, ''))
      if (fs.existsSync(fpath)) fs.unlinkSync(fpath)
    }

    await prisma.exam.delete({ where: { id } })
    return reply.code(204).send()
  })
}
