import { FastifyInstance } from "fastify"
import fs from "fs/promises"
import path from "node:path"
import crypto from "crypto"
import OpenAI from "openai"
import pdfParse from "pdf-parse"
import { prisma } from "../lib/prisma"
import { authenticate } from "../plugins/auth"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function parseDigitableLine(line: string) {
  const digits = line.replace(/\D/g, "")
  if (digits.length !== 47) return null

  const campo1 = digits.substring(0, 9)
  const campo2 = digits.substring(10, 20)
  const campo3 = digits.substring(21, 31)
  const dvGeral = digits.substring(32, 33)
  const campo5 = digits.substring(33, 47)

  const barcode =
    campo1.substring(0, 4) + dvGeral + campo5 +
    campo1.substring(4, 9) + campo2 + campo3

  if (barcode.length !== 44) return null

  const bankCode = barcode.substring(0, 3)
  const dueFactor = parseInt(barcode.substring(5, 9), 10)
  const baseDate = new Date(1997, 9, 7)
  baseDate.setDate(baseDate.getDate() + (dueFactor - 1000))
  const dueDate = baseDate.toISOString().split("T")[0]

  const amount = parseInt(barcode.substring(9, 19), 10) / 100

  return { barcode, bankCode, amount, dueDate, digitableLine: digits }
}

export async function boletosOcrRoutes(app: FastifyInstance) {

  // POST /api/financial/ocr/boleto
  app.post(
    "/boleto",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const data = await request.file()

      if (!data) {
        return reply.code(400).send({ error: "Nenhum arquivo enviado" })
      }

      if (data.mimetype !== "application/pdf") {
        data.file.resume()
        return reply.code(400).send({ error: "Apenas PDFs são aceitos" })
      }

      try {
        const buffer = await data.toBuffer()

        // Salvar PDF no disco
        const fileName = `${crypto.randomUUID()}.pdf`
        const uploadDir = path.join(process.cwd(), "uploads", "boletos")
        await fs.mkdir(uploadDir, { recursive: true })
        await fs.writeFile(path.join(uploadDir, fileName), buffer)
        const fileUrl = `/uploads/boletos/${fileName}`

        // Estratégia 1: extrair texto do PDF
        let boletoData = null
        try {
          const pdfData = await pdfParse(buffer)
          const text = pdfData.text

          if (text.length > 50) {
            const match = text.match(
              /(\d{5}[\s.]?\d{5}\s?\d{5}[\s.]?\d{6}\s?\d{5}[\s.]?\d{6}\s?\d{1}\s?\d{14})/
            )

            if (match) {
              const parsed = parseDigitableLine(match[0])
              if (parsed) {
                // Estruturar fornecedor via GPT
                const gptRes = await openai.chat.completions.create({
                  model: "gpt-4o-mini",
                  messages: [
                    {
                      role: "system",
                      content: `Extraia do texto de um boleto: supplier (beneficiário), supplierCnpj, description.
Retorne JSON: {"supplier": string, "supplierCnpj": string|null, "description": string}`,
                    },
                    { role: "user", content: text.substring(0, 3000) },
                  ],
                  response_format: { type: "json_object" },
                  temperature: 0,
                })

                const structured = JSON.parse(
                  gptRes.choices[0].message.content || "{}"
                )

                boletoData = {
                  ...parsed,
                  supplier: structured.supplier || "Desconhecido",
                  supplierCnpj: structured.supplierCnpj || null,
                  description: structured.description || `Boleto ${structured.supplier}`,
                  confidence: 0.95,
                  rawText: text,
                }
              }
            }
          }
        } catch (e) {
          app.log.warn("[OCR Boleto] Falha na extração de texto, tentando Vision...")
        }

        // Estratégia 2: Vision API (fallback)
        if (!boletoData) {
          const base64 = buffer.toString("base64")

          const visionRes = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: `Você é especialista em boletos bancários brasileiros.
Retorne APENAS JSON válido:
{
  "supplier": "nome do beneficiário",
  "supplierCnpj": "CNPJ só números ou null",
  "amount": número decimal,
  "dueDate": "YYYY-MM-DD",
  "digitableLine": "47 dígitos sem formatação",
  "description": "descrição do boleto",
  "bankCode": "3 dígitos",
  "confidence": número de 0 a 1
}`,
              },
              {
                role: "user",
                content: [
                  { type: "text", text: "Extraia os dados deste boleto:" },
                  {
                    type: "image_url",
                    image_url: { url: `data:application/pdf;base64,${base64}` },
                  },
                ],
              },
            ],
            response_format: { type: "json_object" },
            temperature: 0,
          })

          const visionData = JSON.parse(
            visionRes.choices[0].message.content || "{}"
          )

          boletoData = {
            supplier: visionData.supplier || "Desconhecido",
            supplierCnpj: visionData.supplierCnpj || null,
            amount: parseFloat(visionData.amount) || 0,
            dueDate: visionData.dueDate || new Date().toISOString().split("T")[0],
            digitableLine: visionData.digitableLine?.replace(/\D/g, "") || "",
            barcode: null,
            bankCode: visionData.bankCode || null,
            description: visionData.description || `Boleto ${visionData.supplier}`,
            confidence: visionData.confidence || 0.7,
            rawText: "Extraído via Vision API",
          }
        }

        // Salvar no banco
        const needsReview = boletoData.confidence < 0.85
        const category = (data.fields?.category as any)?.value || "Outros"

        const accountPayable = await prisma.accountPayable.create({
          data: {
            description: boletoData.description,
            supplier: boletoData.supplier || "Desconhecido",
            supplierCnpj: boletoData.supplierCnpj,
            amount: boletoData.amount,
            dueDate: new Date(boletoData.dueDate),
            category,
            digitableLine: boletoData.digitableLine,
            barcode: boletoData.barcode,
            bankCode: boletoData.bankCode,
            fileUrl,
            ocrRawText: boletoData.rawText,
            ocrConfidence: boletoData.confidence,
            ocrStatus: needsReview ? "MANUAL_REVIEW" : "SUCCESS",
            status: "PENDING",
          },
        })

        return reply.send({
          success: true,
          data: accountPayable,
          extracted: boletoData,
        })
      } catch (err: any) {
        app.log.error(err)
        return reply.code(500).send({
          error: "Falha ao processar boleto",
          message: err.message,
        })
      }
    }
  )

  // GET /api/financial/ocr/boleto/:id
  app.get(
    "/boleto/:id",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const account = await prisma.accountPayable.findUnique({ where: { id } })
      if (!account) return reply.code(404).send({ error: "Não encontrado" })
      return account
    }
  )

  // PATCH /api/financial/ocr/boleto/:id/confirm
  app.patch(
    "/boleto/:id/confirm",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const body = request.body as any
      const updated = await prisma.accountPayable.update({
        where: { id },
        data: { ...body, ocrStatus: "SUCCESS" },
      })
      return updated
    }
  )
}