import type { FastifyPluginAsync } from 'fastify'
import OpenAI from 'openai'
import { prisma } from '../lib/prisma2'

type ChatMessage = {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string | null
  tool_calls?: any[]
  tool_call_id?: string
}

type ChatBody = {
  messages?: ChatMessage[]
  phone?: string
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

function cleanValue(value: string | null | undefined, fallback = 'Não informado') {
  const text = String(value ?? '').trim()
  return text.length > 0 ? text : fallback
}

function getLocalDateISO() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseISODateOnly(dateStr: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(year, month, day, 0, 0, 0, 0)

  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null
  }
  return date
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

function formatHHMM(date: Date) {
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && endA > startB
}

async function findDoctorsBySpecialty(specialty: string) {
  const normalized = specialty.trim()
  let doctors = await prisma.doctor.findMany({
    where: { specialty: { contains: normalized } },
    select: { id: true, specialty: true, crm: true, crmState: true, consultationFee: true },
    orderBy: { specialty: 'asc' },
  })

  if (doctors.length > 0) return doctors

  const tokens = normalized.split(/\s+/).map((t) => t.trim()).filter((t) => t.length >= 4)
  if (tokens.length === 0) return []

  return await prisma.doctor.findMany({
    where: { OR: tokens.map((token) => ({ specialty: { contains: token } })) },
    select: { id: true, specialty: true, crm: true, crmState: true, consultationFee: true },
    orderBy: { specialty: 'asc' },
  })
}

async function getAvailableScheduleForSpecialty(params: { date: string; specialty: string }) {
  const requestedDate = parseISODateOnly(params.date)
  if (!requestedDate) return { status: 'error', code: 'INVALID_DATE', message: 'Data inválida. Use YYYY-MM-DD.' }

  const today = parseISODateOnly(getLocalDateISO())
  if (!today) return { status: 'error', code: 'SYSTEM_DATE_ERROR', message: 'Erro na data do sistema.' }

  if (requestedDate < today) {
    return { status: 'error', code: 'PAST_DATE', message: 'A data solicitada está no passado. Peça uma nova data.' }
  }

  const doctors = await findDoctorsBySpecialty(params.specialty)
  if (doctors.length === 0) {
    return { status: 'success', code: 'NO_DOCTORS_FOUND', slots: [], message: 'Sem médicos para essa especialidade.' }
  }

  const doctorIds = doctors.map((d) => d.id)
  const startOfDay = new Date(requestedDate.getFullYear(), requestedDate.getMonth(), requestedDate.getDate(), 0, 0, 0, 0)
  const endOfDay = new Date(requestedDate.getFullYear(), requestedDate.getMonth(), requestedDate.getDate() + 1, 0, 0, 0, 0)

  const appointments = await prisma.appointment.findMany({
    where: { doctorId: { in: doctorIds }, startTime: { gte: startOfDay, lt: endOfDay } },
    select: { doctorId: true, startTime: true, endTime: true, status: true },
    orderBy: { startTime: 'asc' },
  })

  const blocked = new Map<string, { startTime: Date; endTime: Date; status: string }[]>()
  for (const app of appointments) {
    const status = String(app.status)
    if (status === 'CANCELLED' || status === 'CANCELED') continue
    const list = blocked.get(app.doctorId) ?? []
    list.push({ startTime: app.startTime, endTime: app.endTime, status })
    blocked.set(app.doctorId, list)
  }

  const rawSlots: Array<any> = []
  for (const doctor of doctors) {
    const docBlocked = blocked.get(doctor.id) ?? []
    let slotStart = new Date(requestedDate.getFullYear(), requestedDate.getMonth(), requestedDate.getDate(), 8, 0, 0, 0)
    const workEnd = new Date(requestedDate.getFullYear(), requestedDate.getMonth(), requestedDate.getDate(), 18, 0, 0, 0)

    while (slotStart < workEnd) {
      const slotEnd = addMinutes(slotStart, 30)
      if (slotEnd > workEnd) break

      const hasOverlap = docBlocked.some((app) => rangesOverlap(slotStart, slotEnd, app.startTime, app.endTime))
      if (!hasOverlap) {
        rawSlots.push({
          doctorId: doctor.id,
          specialty: doctor.specialty,
          time: formatHHMM(slotStart),
          isoStart: slotStart.toISOString()
        })
      }
      slotStart = addMinutes(slotStart, 30)
    }
  }

  rawSlots.sort((a, b) => a.isoStart.localeCompare(b.isoStart))

  const uniqueSlotsByTime = new Map<string, any>()
  for (const slot of rawSlots) {
    if (!uniqueSlotsByTime.has(slot.time)) uniqueSlotsByTime.set(slot.time, slot)
  }

  const slots = Array.from(uniqueSlotsByTime.values()).slice(0, 12)

  return {
    status: 'success',
    code: slots.length > 0 ? 'SLOTS_FOUND' : 'NO_SLOTS_FOUND',
    date: params.date,
    specialty: params.specialty,
    slots,
    message: slots.length > 0 ? 'Horários disponíveis.' : 'Sem horários livres para esta data.',
  }
}

const tools = [
  {
    type: 'function',
    function: {
      name: 'verificar_agenda',
      description: 'Verifica horários disponíveis reais no sistema.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Data YYYY-MM-DD' },
          specialty: { type: 'string' },
        },
        required: ['date', 'specialty'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'salvar_lead_pre_agendamento',
      description: 'Salva os dados do paciente. Retorna o leadId, que é obrigatório para criar o pré-agendamento depois.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          phone: { type: 'string' },
          specialty: { type: 'string' },
        },
        required: ['name', 'phone', 'specialty'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'criar_pre_agendamento',
      description: 'Cria o pré-agendamento definitivo DEPOIS que o paciente escolheu o horário.',
      parameters: {
        type: 'object',
        properties: {
          leadId: { type: 'string', description: 'O ID do lead retornado pela ferramenta salvar_lead_pre_agendamento' },
          doctorId: { type: 'string', description: 'O ID do médico retornado pela ferramenta verificar_agenda' },
          date: { type: 'string', description: 'Data escolhida (YYYY-MM-DD)' },
          time: { type: 'string', description: 'Horário escolhido (HH:MM)' },
          specialty: { type: 'string' },
        },
        required: ['leadId', 'doctorId', 'date', 'time', 'specialty'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'registrar_intencao_atendimento',
      description: 'Registra a principal intenção da conversa.',
      parameters: {
        type: 'object',
        properties: {
          intent: { type: 'string', enum: ['agendamento', 'pagamento', 'urgencia', 'humano', 'duvida_telemedicina'] },
        },
        required: ['intent'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_paciente_por_telefone',
      description: 'Busca dados do paciente pelo telefone. Retorna informações como nome, CPF, histórico de consultas, etc.',
      parameters: {
        type: 'object',
        properties: {
          phone: { type: 'string', description: 'Telefone do paciente' },
        },
        required: ['phone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'verificar_pagamentos_paciente',
      description: 'Verifica pagamentos pendentes ou realizados do paciente.',
      parameters: {
        type: 'object',
        properties: {
          patientId: { type: 'string', description: 'ID do paciente' },
        },
        required: ['patientId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'confirmar_pagamento',
      description: 'Confirma o pagamento de uma consulta ou cobrança.',
      parameters: {
        type: 'object',
        properties: {
          paymentId: { type: 'string', description: 'ID do pagamento' },
          status: { type: 'string', enum: ['PAID', 'PENDING', 'OVERDUE'] },
        },
        required: ['paymentId', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'transferir_chat_para_medico',
      description: 'Transfere o chat atual para um médico específico.',
      parameters: {
        type: 'object',
        properties: {
          phone: { type: 'string', description: 'Telefone do chat' },
          doctorId: { type: 'string', description: 'ID do médico' },
        },
        required: ['phone', 'doctorId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'marcar_consulta_como_agendada',
      description: 'Converte um pré-agendamento em consulta agendada definitiva.',
      parameters: {
        type: 'object',
        properties: {
          preAppointmentId: { type: 'string', description: 'ID do pré-agendamento' },
        },
        required: ['preAppointmentId'],
      },
    },
  },
]

function buildSystemPrompt(config: any, patientContext: string = '') {
  const today = getLocalDateISO()

  return `
Você é a atendente virtual oficial da clínica "${cleanValue(config.clinicName, 'maissaudebr')}", atuando pelo WhatsApp.

DATA DE REFERÊNCIA DO SISTEMA: ${today} (Use para calcular datas como "amanhã")

DADOS DA CLÍNICA:
- WhatsApp: ${cleanValue(config.whatsappNumber)}
- Pix: ${cleanValue(config.pixKey)}
- Valor Padrão: ${cleanValue(config.defaultConsultationFee)}

${patientContext ? `CONTEXTO DO PACIENTE: ${patientContext}` : ''}

FLUXO OBRIGATÓRIO DE AGENDAMENTO (Siga esta ordem exata):
1. O paciente pede para agendar.
2. Você coleta os dados básicos (Nome, Especialidade e Telefone).
3. Você usa IMEDIATAMENTE a ferramenta "salvar_lead_pre_agendamento" para gerar o "leadId".
4. Você pergunta o dia de preferência ou já usa a ferramenta "verificar_agenda" se ele tiver informado.
5. Você oferece os horários disponíveis (apenas os retornados na ferramenta).
6. O paciente ESCOLHE o horário.
7. Você usa IMEDIATAMENTE a ferramenta "criar_pre_agendamento" passando o leadId, o doctorId (que veio na agenda), a data e a hora.
8. Após o sucesso do pré-agendamento, você informa ao paciente que o horário está reservado e envia as instruções de pagamento se houver.

REGRAS:
- Nunca use "criar_pre_agendamento" sem ter o leadId. Se não tiver, salve o lead primeiro.
- Seja breve e conversacional. Não mande blocos gigantes de texto.
- Não invente horários nem médicos.
- Fale de forma acolhedora.
- Use as ferramentas disponíveis para buscar dados de pacientes, verificar pagamentos, confirmar pagamentos, transferir chat para médico, e marcar consultas como agendadas.
- Para transferir chat, use a ferramenta "transferir_chat_para_medico" quando o paciente pedir para falar com um médico ou em casos de urgência.
`.trim()
}

export const chatRoutes: FastifyPluginAsync = async (app) => {
  app.post('/chat', async (request, reply) => {
    try {
      if (!process.env.OPENAI_API_KEY) {
        reply.code(500)
        return { error: 'OPENAI_API_KEY não configurada.' }
      }

      const body = request.body as ChatBody
      const messages = Array.isArray(body.messages) ? body.messages : []
      const phone = body.phone || 'simulador'

      // Criar ou atualizar chat
      const chat = await prisma.chat.upsert({
        where: { phone },
        update: { lastMessageAt: new Date() },
        create: { phone, lastMessageAt: new Date() },
        include: { patient: true },
      })

      // Se há patientId no chat, usar para contexto
      let patientContext = ''
      if (chat.patientId) {
        patientContext = `Paciente identificado: ${chat.patient?.fullName} (CPF: ${chat.patient?.cpf})`
      }

      const sanitizedMessages = messages.filter((m) => m && ['user', 'assistant', 'system', 'tool'].includes(m.role)).map((m) => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content.trim() : m.content,
        tool_calls: m.tool_calls,
        tool_call_id: m.tool_call_id,
      }))

      if (sanitizedMessages.length === 0) {
        reply.code(400)
        return { error: 'Envie pelo menos uma mensagem.' }
      }

      const lastMessage = sanitizedMessages[sanitizedMessages.length - 1]
      if (lastMessage && lastMessage.role === 'user' && lastMessage.content) {
        await prisma.chatLog.create({ data: { phone, message: lastMessage.content, isUser: true } })
      }

      const config = await prisma.config.findFirst()
      if (!config) {
        reply.code(500)
        return { error: 'Configuração da clínica não encontrada.' }
      }

      const origin = request.headers.origin || '*'
      reply.raw.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      })

      async function processChatStream(msgs: ChatMessage[]) {
        const stream = await openai.chat.completions.create({
          model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
          stream: true,
          temperature: 0.3, // Temp baixa para ser mais determinístico no fluxo
          messages: msgs as any,
          tools: tools as any,
          tool_choice: 'auto',
        })

        let isToolCall = false
        const toolCalls: any[] = []
        let assistantContent = ''

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta

          if (delta?.tool_calls) {
            isToolCall = true
            for (const tc of delta.tool_calls) {
              const index = tc.index
              if (!toolCalls[index]) {
                toolCalls[index] = { id: tc.id, type: tc.type, function: { name: tc.function?.name || '', arguments: tc.function?.arguments || '' } }
              } else {
                if (tc.function?.name) toolCalls[index].function.name += tc.function.name
                if (tc.function?.arguments) toolCalls[index].function.arguments += tc.function.arguments
              }
            }
          }

          if (!isToolCall && delta?.content) {
            assistantContent += delta.content
            reply.raw.write(delta.content)
          }
        }

        if (isToolCall) {
          msgs.push({ role: 'assistant', content: null, tool_calls: toolCalls })

          for (const tool of toolCalls) {
            let result = ''
            try {
              const args = JSON.parse(tool.function.arguments || '{}')

              if (tool.function.name === 'verificar_agenda') {
                const schedule = await getAvailableScheduleForSpecialty({ date: String(args.date || ''), specialty: String(args.specialty || '') })
                result = JSON.stringify(schedule)
              } 
              
              else if (tool.function.name === 'salvar_lead_pre_agendamento') {
                const name = String(args.name || '').trim()
                const leadPhone = String(args.phone || phone).trim()
                const specialty = String(args.specialty || '').trim()

                let lead = await prisma.lead.findFirst({ where: { phone: leadPhone }, orderBy: { createdAt: 'desc' } })
                if (lead) {
                  lead = await prisma.lead.update({ where: { id: lead.id }, data: { name, specialty, status: 'PENDING_SCHEDULING' } })
                } else {
                  lead = await prisma.lead.create({ data: { name, phone: leadPhone, specialty, status: 'PENDING_SCHEDULING' } })
                }
                result = JSON.stringify({ status: 'success', leadId: lead.id, message: 'Lead salvo. Agora você tem o leadId.' })
              } 
              
              else if (tool.function.name === 'criar_pre_agendamento') {
                // NOVA AÇÃO DE PRÉ-AGENDAMENTO
                const { leadId, doctorId, date, time, specialty } = args
                if (!leadId || !doctorId || !date || !time) {
                  result = JSON.stringify({ status: 'error', message: 'Faltam dados: leadId, doctorId, date ou time.' })
                } else {
                  const preAppt = await prisma.preAppointment.create({
                    data: { leadId, doctorId, date, time, specialty: specialty || '' }
                  })
                  result = JSON.stringify({ status: 'success', preAppointmentId: preAppt.id, message: 'Pré-agendamento CONFIRMADO e salvo no banco de dados!' })
                }
              }
              
              else if (tool.function.name === 'registrar_intencao_atendimento') {
                await prisma.chatLog.create({ data: { phone, intent: args.intent, message: `Intenção: ${args.intent}`, isUser: false } })
                result = JSON.stringify({ status: 'success' })
              }

              else if (tool.function.name === 'buscar_paciente_por_telefone') {
                const patientPhone = String(args.phone || '').trim().replace(/\D/g, '')
                const patient = await prisma.patient.findFirst({ where: { phone: { contains: patientPhone } } })
                if (patient) {
                  const appointments = await prisma.appointment.count({ where: { patientId: patient.id } })
                  result = JSON.stringify({ status: 'success', patient: { id: patient.id, name: patient.fullName, cpf: patient.cpf, appointmentsCount: appointments } })
                } else {
                  result = JSON.stringify({ status: 'not_found', message: 'Paciente não encontrado.' })
                }
              }

              else if (tool.function.name === 'verificar_pagamentos_paciente') {
                const payments = await prisma.payment.findMany({ where: { patientId: args.patientId }, orderBy: { createdAt: 'desc' } })
                result = JSON.stringify({ status: 'success', payments: payments.map(p => ({ id: p.id, amount: p.amount, status: p.status, dueDate: p.dueDate })) })
              }

              else if (tool.function.name === 'confirmar_pagamento') {
                await prisma.payment.update({ where: { id: args.paymentId }, data: { status: args.status } })
                result = JSON.stringify({ status: 'success', message: 'Pagamento atualizado.' })
              }

              else if (tool.function.name === 'transferir_chat_para_medico') {
                const chat = await prisma.chat.upsert({ where: { phone: args.phone }, update: { status: 'TRANSFERRED_TO_DOCTOR', transferredToDoctorId: args.doctorId }, create: { phone: args.phone, status: 'TRANSFERRED_TO_DOCTOR', transferredToDoctorId: args.doctorId } })
                result = JSON.stringify({ status: 'success', chatId: chat.id, message: 'Chat transferido para o médico.' })
              }

              else if (tool.function.name === 'marcar_consulta_como_agendada') {
                const preAppt = await prisma.preAppointment.findUnique({ where: { id: args.preAppointmentId } })
                if (preAppt) {
                  // Criar appointment real
                  const doctor = await prisma.doctor.findUnique({ where: { id: preAppt.doctorId } })
                  const lead = await prisma.lead.findUnique({ where: { id: preAppt.leadId } })
                  if (doctor && lead) {
                    const startTime = new Date(`${preAppt.date}T${preAppt.time}:00`)
                    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000) // 30 min
                    await prisma.appointment.create({ data: { patientId: (lead as any).patientId || '', doctorId: preAppt.doctorId, startTime, endTime, status: 'SCHEDULED' } })
                    await prisma.preAppointment.update({ where: { id: args.preAppointmentId }, data: { status: 'CONFIRMED' } })
                    result = JSON.stringify({ status: 'success', message: 'Consulta agendada.' })
                  } else {
                    result = JSON.stringify({ status: 'error', message: 'Dados inválidos.' })
                  }
                } else {
                  result = JSON.stringify({ status: 'error', message: 'Pré-agendamento não encontrado.' })
                }
              }
            } catch (error) {
              result = JSON.stringify({ status: 'error', message: error instanceof Error ? error.message : 'Erro.' })
            }

            msgs.push({ role: 'tool', tool_call_id: tool.id, content: result })
          }

          await processChatStream(msgs)
          return
        }

        if (assistantContent.trim()) {
          await prisma.chatLog.create({ data: { phone, message: assistantContent, isUser: false } })
        }
        reply.raw.end()
      }

      await processChatStream([{ role: 'system', content: buildSystemPrompt(config, patientContext) }, ...sanitizedMessages])
    } catch (error) {
      request.log.error(error)
      if (!reply.raw.headersSent) reply.code(500)
      reply.raw.write('\n\nDesculpe, tive uma instabilidade ao responder. Por favor, tente novamente.')
      reply.raw.end()
    }
  })
}