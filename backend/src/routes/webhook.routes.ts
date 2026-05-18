import { FastifyInstance } from 'fastify'
import axios from 'axios'
import OpenAI from 'openai'
import { prisma } from '../lib/prisma2'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getLocalDateISO() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function cleanValue(value: string | null | undefined, fallback = 'Não informado') {
  const text = String(value ?? '').trim()
  return text.length > 0 ? text : fallback
}

function parseISODateOnly(dateStr: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!match) return null
  const year = Number(match[1]), month = Number(match[2]) - 1, day = Number(match[3])
  const date = new Date(year, month, day, 0, 0, 0, 0)
  return (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) ? date : null
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

function formatHHMM(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && endA > startB
}

// ─── Agenda ──────────────────────────────────────────────────────────────────

async function findDoctorsBySpecialty(specialty: string) {
  const normalized = specialty.trim()
  let doctors = await prisma.doctor.findMany({
    where: { specialty: { contains: normalized } },
    select: { id: true, specialty: true, crm: true, consultationFee: true },
    orderBy: { specialty: 'asc' },
  })
  if (doctors.length > 0) return doctors
  const tokens = normalized.split(/\s+/).filter(t => t.length >= 4)
  return prisma.doctor.findMany({
    where: { OR: tokens.map(token => ({ specialty: { contains: token } })) },
    select: { id: true, specialty: true, crm: true, consultationFee: true },
    orderBy: { specialty: 'asc' },
  })
}

async function getAvailableScheduleForSpecialty(params: { date: string; specialty: string }) {
  const requestedDate = parseISODateOnly(params.date)
  if (!requestedDate) return { status: 'error', code: 'INVALID_DATE', message: 'Data inválida. Use YYYY-MM-DD.' }

  const today = parseISODateOnly(getLocalDateISO())
  if (!today) return { status: 'error', code: 'SYSTEM_DATE_ERROR', message: 'Erro na data do sistema.' }
  if (requestedDate < today) return { status: 'error', code: 'PAST_DATE', message: 'Data no passado. Peça uma nova data.' }

  const doctors = await findDoctorsBySpecialty(params.specialty)
  if (doctors.length === 0) return { status: 'success', code: 'NO_DOCTORS_FOUND', slots: [], message: 'Sem médicos para essa especialidade.' }

  const doctorIds = doctors.map(d => d.id)
  const startOfDay = new Date(requestedDate.getFullYear(), requestedDate.getMonth(), requestedDate.getDate(), 0, 0, 0, 0)
  const endOfDay = new Date(requestedDate.getFullYear(), requestedDate.getMonth(), requestedDate.getDate() + 1, 0, 0, 0, 0)

  const appointments = await prisma.appointment.findMany({
    where: { doctorId: { in: doctorIds }, startTime: { gte: startOfDay, lt: endOfDay } },
    select: { doctorId: true, startTime: true, endTime: true, status: true },
  })

  const blocked = new Map<string, { startTime: Date; endTime: Date }[]>()
  for (const app of appointments) {
    const status = String(app.status)
    if (status === 'CANCELLED' || status === 'CANCELED') continue
    const list = blocked.get(app.doctorId) ?? []
    list.push({ startTime: app.startTime, endTime: app.endTime })
    blocked.set(app.doctorId, list)
  }

  const rawSlots: any[] = []
  for (const doctor of doctors) {
    const docBlocked = blocked.get(doctor.id) ?? []
    let slotStart = new Date(requestedDate.getFullYear(), requestedDate.getMonth(), requestedDate.getDate(), 8, 0, 0, 0)
    const workEnd = new Date(requestedDate.getFullYear(), requestedDate.getMonth(), requestedDate.getDate(), 18, 0, 0, 0)
    while (slotStart < workEnd) {
      const slotEnd = addMinutes(slotStart, 30)
      if (slotEnd > workEnd) break
      if (!docBlocked.some(a => rangesOverlap(slotStart, slotEnd, a.startTime, a.endTime))) {
        rawSlots.push({ doctorId: doctor.id, specialty: doctor.specialty, time: formatHHMM(slotStart), isoStart: slotStart.toISOString() })
      }
      slotStart = addMinutes(slotStart, 30)
    }
  }

  rawSlots.sort((a, b) => a.isoStart.localeCompare(b.isoStart))
  const unique = new Map<string, any>()
  for (const slot of rawSlots) if (!unique.has(slot.time)) unique.set(slot.time, slot)
  const slots = Array.from(unique.values()).slice(0, 12)

  return { status: 'success', code: slots.length > 0 ? 'SLOTS_FOUND' : 'NO_SLOTS_FOUND', date: params.date, specialty: params.specialty, slots, message: slots.length > 0 ? 'Horários disponíveis.' : 'Sem horários livres.' }
}

// ─── Tools ───────────────────────────────────────────────────────────────────

const tools = [
  { type: 'function', function: { name: 'verificar_agenda', description: 'Verifica horários disponíveis reais no sistema.', parameters: { type: 'object', properties: { date: { type: 'string', description: 'Data YYYY-MM-DD' }, specialty: { type: 'string' } }, required: ['date', 'specialty'] } } },
  { type: 'function', function: { name: 'salvar_lead_pre_agendamento', description: 'Salva os dados do paciente. Retorna leadId obrigatório para criar pré-agendamento.', parameters: { type: 'object', properties: { name: { type: 'string' }, phone: { type: 'string' }, specialty: { type: 'string' } }, required: ['name', 'phone', 'specialty'] } } },
  { type: 'function', function: { name: 'criar_pre_agendamento', description: 'Cria o pré-agendamento após o paciente escolher o horário.', parameters: { type: 'object', properties: { leadId: { type: 'string' }, doctorId: { type: 'string' }, date: { type: 'string' }, time: { type: 'string' }, specialty: { type: 'string' } }, required: ['leadId', 'doctorId', 'date', 'time', 'specialty'] } } },
  { type: 'function', function: { name: 'registrar_intencao_atendimento', description: 'Registra a intenção da conversa.', parameters: { type: 'object', properties: { intent: { type: 'string', enum: ['agendamento', 'pagamento', 'urgencia', 'humano', 'duvida_telemedicina'] } }, required: ['intent'] } } },
  { type: 'function', function: { name: 'buscar_paciente_por_telefone', description: 'Busca dados do paciente pelo telefone.', parameters: { type: 'object', properties: { phone: { type: 'string' } }, required: ['phone'] } } },
]

// ─── Execução das ferramentas ─────────────────────────────────────────────────

async function executeTool(name: string, args: any, phone: string): Promise<any> {
  try {
    if (name === 'verificar_agenda') {
      return await getAvailableScheduleForSpecialty({ date: String(args.date || ''), specialty: String(args.specialty || '') })
    }

    if (name === 'salvar_lead_pre_agendamento') {
      const name_ = String(args.name || '').trim()
      const leadPhone = String(args.phone || phone).trim()
      const specialty = String(args.specialty || '').trim()
      let lead = await prisma.lead.findFirst({ where: { phone: leadPhone }, orderBy: { createdAt: 'desc' } })
      if (lead) {
        lead = await prisma.lead.update({ where: { id: lead.id }, data: { name: name_, specialty, status: 'PENDING_SCHEDULING' } })
      } else {
        lead = await prisma.lead.create({ data: { name: name_, phone: leadPhone, specialty, status: 'PENDING_SCHEDULING' } })
      }
      return { status: 'success', leadId: lead.id, message: 'Lead salvo. Use este leadId no pré-agendamento.' }
    }

    if (name === 'criar_pre_agendamento') {
      const { leadId, doctorId, date, time, specialty } = args
      if (!leadId || !doctorId || !date || !time) {
        return { status: 'error', message: 'Faltam dados: leadId, doctorId, date ou time.' }
      }
      const preAppt = await prisma.preAppointment.create({
        data: { leadId, doctorId, date, time, specialty: specialty || '' }
      })
      return { status: 'success', preAppointmentId: preAppt.id, message: 'Pré-agendamento confirmado no sistema!' }
    }

    if (name === 'registrar_intencao_atendimento') {
      await prisma.chatLog.create({ data: { phone, intent: args.intent, message: `Intenção: ${args.intent}`, isUser: false } })
      return { status: 'success' }
    }

    if (name === 'buscar_paciente_por_telefone') {
      const digits = String(args.phone || '').replace(/\D/g, '')
      const patient = await prisma.patient.findFirst({ where: { phone: { contains: digits } } })
      if (patient) {
        const count = await prisma.appointment.count({ where: { patientId: patient.id } })
        return { status: 'success', patient: { id: patient.id, name: patient.fullName, cpf: patient.cpf, appointmentsCount: count } }
      }
      return { status: 'not_found', message: 'Paciente não encontrado.' }
    }

    return { status: 'error', message: `Ferramenta desconhecida: ${name}` }
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Erro.' }
  }
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(config: any) {
  const today = getLocalDateISO()
  const clinicName = cleanValue(config?.clinicName, 'maissaudebr')
  return `Você é a atendente virtual oficial da clínica "${clinicName}", atendendo pelo WhatsApp.

DATA DE REFERÊNCIA: ${today} (use para calcular "amanhã", "semana que vem", etc.)

DADOS DA CLÍNICA:
- WhatsApp: ${cleanValue(config?.whatsappNumber)}
- Pix: ${cleanValue(config?.pixKey)}
- Valor padrão consulta: ${cleanValue(config?.defaultConsultationFee)}

FLUXO OBRIGATÓRIO DE AGENDAMENTO:
1. Paciente pede agendamento
2. Colete: nome completo, especialidade e telefone
3. Use IMEDIATAMENTE "salvar_lead_pre_agendamento" para gerar o leadId
4. Use "verificar_agenda" para mostrar horários disponíveis
5. Paciente escolhe o horário
6. Use IMEDIATAMENTE "criar_pre_agendamento" com leadId, doctorId, date e time
7. Confirme o agendamento e informe instruções de pagamento se houver

REGRAS:
- Nunca use "criar_pre_agendamento" sem ter o leadId
- Não invente horários nem médicos — use apenas os retornados pela agenda
- Seja breve e acolhedora
- Para urgências, ofereça transferir para atendente humano`.trim()
}

// ─── IA com ferramentas (loop não-streaming) ──────────────────────────────────

async function callWithTools(messages: any[], phone: string, depth = 0): Promise<string | null> {
  if (depth > 5) return 'Desculpe, tive dificuldade em processar sua solicitação. Um atendente entrará em contato.'

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
    messages,
    tools: tools as any,
    tool_choice: 'auto',
    temperature: 0.3,
    max_tokens: 800,
  })

  const choice = response.choices[0]
  const msg = choice.message

  if (choice.finish_reason === 'tool_calls' && msg.tool_calls?.length) {
    messages.push(msg)
    for (const tc of msg.tool_calls) {
      const args = JSON.parse(tc.function.arguments || '{}')
      const result = await executeTool(tc.function.name, args, phone)
      messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) })
    }
    return callWithTools(messages, phone, depth + 1)
  }

  return msg.content ?? null
}

async function processWithAI(phone: string, userMessage: string) {
  try {
    const config = await prisma.config.findFirst()
    const systemPrompt = buildSystemPrompt(config)

    const history = await prisma.chatLog.findMany({
      where: { phone, intent: null },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...history.reverse().map(log => ({
        role: log.isUser ? 'user' : 'assistant',
        content: log.message,
      })),
      { role: 'user', content: userMessage },
    ]

    const aiResponse = await callWithTools(messages, phone)
    if (!aiResponse) return

    await prisma.chatLog.create({ data: { phone, message: aiResponse, isUser: false } })
    await sendZAPIMessage(phone, aiResponse)
  } catch (err) {
    console.error('[webhook] AI error:', err)
  }
}

// ─── Z-API ───────────────────────────────────────────────────────────────────

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

// ─── Rota ─────────────────────────────────────────────────────────────────────

export async function webhookRoutes(app: FastifyInstance) {
  app.post('/webhook', async (request, reply) => {
    const body = request.body as any

    if (body.type !== 'ReceivedCallback' || !body.text?.message || body.isGroup) {
      return reply.send({ ok: true })
    }

    const phone = String(body.phone)
    const message = String(body.text.message)

    await prisma.chat.upsert({
      where: { phone },
      update: { lastMessageAt: new Date() },
      create: { phone, lastMessageAt: new Date() },
    })

    await prisma.chatLog.create({ data: { phone, message, isUser: true } })

    reply.send({ ok: true })
    processWithAI(phone, message)
  })
}
