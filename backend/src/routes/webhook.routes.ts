import { FastifyInstance } from 'fastify'
import axios from 'axios'
import OpenAI from 'openai'
import { prisma } from '../lib/prisma2'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function getLocalDateISO() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

async function sendZAPIMessage(phone: string, message: string) {
  const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE_ID
  const ZAPI_TOKEN = process.env.ZAPI_TOKEN
  const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN
  if (!ZAPI_INSTANCE || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) return

  const digits = phone.replace(/\D/g, '')
  const formattedPhone = digits.startsWith('55') ? digits : `55${digits}`

  await axios.post(
    `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`,
    { phone: formattedPhone, message },
    { headers: { 'Client-Token': ZAPI_CLIENT_TOKEN, 'Content-Type': 'application/json' } }
  )
}

async function processWithAI(phone: string, userMessage: string) {
  try {
    const config = await prisma.config.findFirst()
    const clinicName = config?.clinicName || 'maissaudebr'
    const today = getLocalDateISO()

    const systemPrompt = `Você é a atendente virtual da clínica "${clinicName}", atendendo pelo WhatsApp.
DATA: ${today}
Seja breve, acolhedora e profissional. Ajude com: agendamentos, informações sobre a clínica e dúvidas gerais.
Para agendamentos, colete: nome completo, especialidade desejada e data de preferência.
Se não puder resolver, informe que um atendente humano entrará em contato em breve.`.trim()

    const history = await prisma.chatLog.findMany({
      where: { phone },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...history.reverse().map(log => ({
        role: log.isUser ? 'user' as const : 'assistant' as const,
        content: log.message,
      })),
      { role: 'user' as const, content: userMessage },
    ]

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      messages,
      temperature: 0.3,
      max_tokens: 500,
    })

    const aiResponse = response.choices[0]?.message?.content
    if (!aiResponse) return

    await prisma.chatLog.create({ data: { phone, message: aiResponse, isUser: false } })
    await sendZAPIMessage(phone, aiResponse)
  } catch (err) {
    console.error('[webhook] AI error:', err)
  }
}

export async function webhookRoutes(app: FastifyInstance) {
  // POST /api/whatsapp/webhook — sem auth, chamado pelo Z-API
  app.post('/webhook', async (request, reply) => {
    const body = request.body as any

    // Ignora eventos que não são mensagens recebidas ou mensagens de grupo
    if (body.type !== 'ReceivedCallback' || !body.text?.message || body.isGroup) {
      return reply.send({ ok: true })
    }

    const phone = String(body.phone)
    const message = String(body.text.message)

    // Cria ou atualiza o chat
    await prisma.chat.upsert({
      where: { phone },
      update: { lastMessageAt: new Date() },
      create: { phone, lastMessageAt: new Date() },
    })

    // Armazena mensagem do usuário
    await prisma.chatLog.create({ data: { phone, message, isUser: true } })

    // Responde ao Z-API imediatamente e processa IA em background
    reply.send({ ok: true })
    processWithAI(phone, message)
  })
}
