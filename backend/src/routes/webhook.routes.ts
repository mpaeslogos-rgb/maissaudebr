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
  const select = {
    id: true, specialty: true, crm: true, consultationFee: true, phone: true,
    user: { select: { name: true } },
  }
  let doctors = await prisma.doctor.findMany({
    where: { specialty: { contains: normalized } },
    select,
    orderBy: { specialty: 'asc' },
  })
  if (doctors.length > 0) return doctors
  const tokens = normalized.split(/\s+/).filter(t => t.length >= 4)
  if (tokens.length === 0) return []
  return prisma.doctor.findMany({
    where: { OR: tokens.map(token => ({ specialty: { contains: token } })) },
    select,
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
  if (doctors.length === 0) return { status: 'success', code: 'NO_DOCTORS_FOUND', slots: [], message: 'Sem médicos cadastrados para essa especialidade.' }

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
        rawSlots.push({
          doctorId: doctor.id,
          doctorName: doctor.user?.name ?? `CRM ${doctor.crm}`,
          specialty: doctor.specialty,
          consultationFee: doctor.consultationFee,
          time: formatHHMM(slotStart),
          isoStart: slotStart.toISOString(),
        })
      }
      slotStart = addMinutes(slotStart, 30)
    }
  }

  rawSlots.sort((a, b) => a.isoStart.localeCompare(b.isoStart))
  const unique = new Map<string, any>()
  for (const slot of rawSlots) if (!unique.has(slot.time)) unique.set(slot.time, slot)
  const slots = Array.from(unique.values()).slice(0, 12)

  return {
    status: 'success',
    code: slots.length > 0 ? 'SLOTS_FOUND' : 'NO_SLOTS_FOUND',
    date: params.date,
    specialty: params.specialty,
    slots,
    message: slots.length > 0 ? 'Horários disponíveis.' : 'Sem horários livres para esta data.',
  }
}

// ─── Busca paciente cadastrado ────────────────────────────────────────────────

async function findPatientByPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  const patient = await prisma.patient.findFirst({
    where: { phone: { contains: digits } },
    include: {
      _count: { select: { appointments: true } },
      appointments: {
        orderBy: { startTime: 'desc' },
        take: 1,
        include: { doctor: { select: { specialty: true, user: { select: { name: true } } } } },
      },
    },
  })
  return patient
}

// ─── Tools ───────────────────────────────────────────────────────────────────

const tools = [
  { type: 'function', function: { name: 'verificar_agenda', description: 'Verifica horários e médicos disponíveis no sistema para uma especialidade e data.', parameters: { type: 'object', properties: { date: { type: 'string', description: 'Data YYYY-MM-DD' }, specialty: { type: 'string', description: 'Especialidade médica' } }, required: ['date', 'specialty'] } } },
  { type: 'function', function: { name: 'salvar_lead_pre_agendamento', description: 'Salva dados do paciente e retorna leadId obrigatório para criar pré-agendamento.', parameters: { type: 'object', properties: { name: { type: 'string' }, phone: { type: 'string' }, specialty: { type: 'string' } }, required: ['name', 'phone', 'specialty'] } } },
  { type: 'function', function: { name: 'criar_pre_agendamento', description: 'Cria o pré-agendamento após paciente confirmar horário e médico.', parameters: { type: 'object', properties: { leadId: { type: 'string' }, doctorId: { type: 'string' }, date: { type: 'string' }, time: { type: 'string' }, specialty: { type: 'string' } }, required: ['leadId', 'doctorId', 'date', 'time', 'specialty'] } } },
  { type: 'function', function: { name: 'registrar_intencao_atendimento', description: 'Registra a intenção principal da conversa.', parameters: { type: 'object', properties: { intent: { type: 'string', enum: ['agendamento', 'pagamento', 'urgencia', 'humano', 'duvida_telemedicina'] } }, required: ['intent'] } } },
  { type: 'function', function: { name: 'buscar_especialidades_disponiveis', description: 'Lista todas as especialidades médicas disponíveis na clínica.', parameters: { type: 'object', properties: {} } } },
]

// ─── Execução das ferramentas ─────────────────────────────────────────────────

async function executeTool(name: string, args: any, phone: string): Promise<any> {
  try {
    if (name === 'verificar_agenda') {
      return await getAvailableScheduleForSpecialty({ date: String(args.date || ''), specialty: String(args.specialty || '') })
    }

    if (name === 'salvar_lead_pre_agendamento') {
      const leadName = String(args.name || '').trim()
      const leadPhone = String(args.phone || phone).trim()
      const specialty = String(args.specialty || '').trim()

      // Se paciente já cadastrado, usa o nome do cadastro
      const patient = await findPatientByPhone(leadPhone)
      const finalName = patient?.fullName || leadName

      let lead = await prisma.lead.findFirst({ where: { phone: leadPhone }, orderBy: { createdAt: 'desc' } })
      if (lead) {
        lead = await prisma.lead.update({ where: { id: lead.id }, data: { name: finalName, specialty, status: 'PENDING_SCHEDULING' } })
      } else {
        lead = await prisma.lead.create({ data: { name: finalName, phone: leadPhone, specialty, status: 'PENDING_SCHEDULING' } })
      }
      return { status: 'success', leadId: lead.id, message: `Lead salvo para ${finalName}. Use este leadId no pré-agendamento.` }
    }

    if (name === 'criar_pre_agendamento') {
      const { leadId, doctorId, date, time, specialty } = args
      if (!leadId || !doctorId || !date || !time) {
        return { status: 'error', message: 'Faltam dados: leadId, doctorId, date ou time.' }
      }
      // Verifica se médico existe
      const doctor = await prisma.doctor.findUnique({ where: { id: doctorId }, include: { user: { select: { name: true } } } })
      if (!doctor) return { status: 'error', message: 'Médico não encontrado.' }

      const preAppt = await prisma.preAppointment.create({
        data: { leadId, doctorId, date, time, specialty: specialty || doctor.specialty }
      })
      return {
        status: 'success',
        preAppointmentId: preAppt.id,
        doctorName: doctor.user?.name ?? `CRM ${doctor.crm}`,
        message: `Pré-agendamento confirmado com ${doctor.user?.name ?? doctor.crm} para ${date} às ${time}!`,
      }
    }

    if (name === 'registrar_intencao_atendimento') {
      await prisma.chatLog.create({ data: { phone, intent: args.intent, message: `Intenção: ${args.intent}`, isUser: false } })
      return { status: 'success' }
    }

    if (name === 'buscar_especialidades_disponiveis') {
      const doctors = await prisma.doctor.findMany({
        where: { user: { isActive: true } },
        select: { specialty: true, user: { select: { name: true } } },
        orderBy: { specialty: 'asc' },
      })
      const especialidades = [...new Set(doctors.map(d => d.specialty))].filter(Boolean)
      return { status: 'success', especialidades, total: especialidades.length }
    }

    return { status: 'error', message: `Ferramenta desconhecida: ${name}` }
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Erro.' }
  }
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(config: any, patientContext: string, leadContext: string) {
  const today = getLocalDateISO()
  const clinicName = cleanValue(config?.clinicName, 'maissaudebr')
  return `Você é a atendente virtual oficial da clínica "${clinicName}", atendendo pelo WhatsApp.

DATA DE REFERÊNCIA: ${today} (use para calcular "amanhã", "semana que vem", etc.)

${patientContext ? `PACIENTE IDENTIFICADO:\n${patientContext}\n` : ''}${leadContext ? `${leadContext}\n` : ''}DADOS DA CLÍNICA:
- WhatsApp: ${cleanValue(config?.whatsappNumber)}
- Pix: ${cleanValue(config?.pixKey)}
- Valor padrão consulta: ${cleanValue(config?.defaultConsultationFee)}

FLUXO OBRIGATÓRIO DE AGENDAMENTO:
1. Paciente pede agendamento
2. Se já identificado, confirme o nome. Se não, colete nome completo, especialidade e telefone
3. Use "salvar_lead_pre_agendamento" para gerar o leadId (ou use o leadId já fornecido acima)
4. Use "verificar_agenda" para mostrar horários e médicos disponíveis (inclui nome do médico e doctorId)
5. Apresente os horários com nome do médico para o paciente escolher
6. Use "criar_pre_agendamento" com leadId, doctorId, date e time
7. Confirme com nome do médico, data e horário. Informe instruções de pagamento se houver

REGRAS:
- Se leadId já está fornecido em LEAD ATIVO acima, use-o diretamente — não chame salvar_lead_pre_agendamento novamente
- Se o paciente já está identificado, chame-o pelo primeiro nome desde a primeira mensagem
- Nunca use "criar_pre_agendamento" sem ter o leadId e o doctorId
- Para obter o doctorId, sempre use verificar_agenda e pegue o doctorId do slot escolhido pelo paciente
- Use apenas médicos e horários retornados pela ferramenta — nunca invente
- Use "buscar_especialidades_disponiveis" se o paciente não souber qual especialidade precisa
- Seja breve, acolhedora e profissional
- Para urgências, ofereça transferir para atendente humano`.trim()
}

// ─── IA com ferramentas (loop não-streaming) ──────────────────────────────────

async function callWithTools(messages: any[], phone: string, depth = 0): Promise<string | null> {
  if (depth > 5) return 'Desculpe, tive dificuldade em processar sua solicitação. Um atendente entrará em contato em breve.'

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
    for (const tc of (msg.tool_calls as any[])) {
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
    // Identifica paciente pelo telefone antes de tudo
    const patient = await findPatientByPhone(phone)
    let patientContext = ''
    if (patient) {
      const lastAppt = patient.appointments[0]
      patientContext = `Nome: ${patient.fullName} | CPF: ${patient.cpf} | ${patient._count.appointments} consulta(s) realizada(s)`
      if (lastAppt) {
        patientContext += ` | Última consulta: ${lastAppt.doctor?.specialty ?? ''} com ${lastAppt.doctor?.user?.name ?? ''}`
      }
    }

    // Busca lead ativo para este telefone — fornece leadId ao AI sem precisar re-chamar salvar_lead
    const existingLead = await prisma.lead.findFirst({
      where: { phone },
      orderBy: { createdAt: 'desc' },
    })
    const leadContext = existingLead
      ? `LEAD ATIVO: leadId=${existingLead.id} | nome=${existingLead.name} | especialidade=${existingLead.specialty || 'não informada'} | status=${existingLead.status}`
      : ''

    const config = await prisma.config.findFirst()
    const systemPrompt = buildSystemPrompt(config, patientContext, leadContext)

    // Busca histórico — a mensagem atual já foi salva antes desta chamada, está no histórico
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

    const chat = await prisma.chat.upsert({
      where: { phone },
      update: { lastMessageAt: new Date() },
      create: { phone, lastMessageAt: new Date() },
    })

    await prisma.chatLog.create({ data: { phone, message, isUser: true } })

    reply.send({ ok: true })
    if (!chat.aiPaused) processWithAI(phone, message)
  })
}
