import cron from 'node-cron'
import axios from 'axios'
import { Resend } from 'resend'
import { prisma } from '../lib/prisma2'

// Manaus = UTC-4 (sem horário de verão)
const MANAUS_OFFSET_MS = -4 * 60 * 60 * 1000

function getDateRangeUTC(daysFromNow: number): { start: Date; end: Date } {
  const now = new Date()
  const manausNow = new Date(now.getTime() + MANAUS_OFFSET_MS)
  const target = new Date(manausNow)
  target.setUTCDate(target.getUTCDate() + daysFromNow)
  target.setUTCHours(0, 0, 0, 0)
  const start = new Date(target.getTime() - MANAUS_OFFSET_MS)
  const end   = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1)
  return { start, end }
}

async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  const url      = process.env.EVOLUTION_API_URL?.replace(/\/$/, '')
  const key      = process.env.EVOLUTION_API_KEY
  const instance = process.env.EVOLUTION_INSTANCE
  if (!url || !key || !instance || !phone) return false

  const digits     = phone.replace(/\D/g, '')
  const normalized = digits.startsWith('55') ? digits : `55${digits}`

  try {
    await axios.post(
      `${url}/message/sendText/${instance}`,
      { number: normalized, text: message },
      { headers: { apikey: key, 'Content-Type': 'application/json' } }
    )
    return true
  } catch {
    return false
  }
}

async function sendEmail(params: {
  to: string
  patientName: string
  doctorName: string
  dateStr: string
  timeStr: string
  clinicName: string
  isToday: boolean
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const from   = process.env.RESEND_FROM_EMAIL || 'noreply@maissaudebr.com.br'
  if (!apiKey || !params.to) return false

  const { patientName, doctorName, dateStr, timeStr, clinicName, isToday } = params
  const quando  = isToday ? 'HOJE' : 'amanhã'
  const subject = `Lembrete: sua consulta é ${quando} — ${clinicName}`

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
    <div style="background:#1B5E3F;padding:24px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:22px">+SaúdeBR</h1>
      <p style="color:#a8d5b5;margin:4px 0 0;font-size:13px">${clinicName}</p>
    </div>
    <div style="padding:32px 28px">
      <p style="color:#333;font-size:15px">Olá, <strong>${patientName}</strong>!</p>
      <p style="color:#333;font-size:15px">Este é um lembrete da sua consulta <strong>${quando}</strong>:</p>
      <div style="background:#f0f7f3;border-left:4px solid #1B5E3F;border-radius:4px;padding:16px 20px;margin:20px 0">
        <p style="margin:0 0 8px;color:#1B5E3F;font-weight:bold;font-size:16px">📅 ${dateStr} às ${timeStr}</p>
        <p style="margin:0;color:#555;font-size:14px">Médico(a): Dr(a). ${doctorName}</p>
      </div>
      <p style="color:#777;font-size:13px">Em caso de dúvidas ou necessidade de cancelamento, entre em contato conosco.</p>
    </div>
    <div style="background:#f9f9f9;border-top:1px solid #eee;padding:16px;text-align:center">
      <p style="color:#aaa;font-size:11px;margin:0">MAIS SAUDE SERVIÇO DE TELEMEDICINA LTDA — CNPJ: 56.990.029/0001-12</p>
    </div>
  </div>
</body>
</html>`

  try {
    const resend = new Resend(apiKey)
    await resend.emails.send({ from, to: params.to, subject, html })
    return true
  } catch {
    return false
  }
}

async function runReminders(isToday: boolean) {
  const label = isToday ? 'D-0' : 'D-1'
  console.log(`[Lembretes ${label}] Iniciando...`)

  const config    = await prisma.config.findFirst()
  const clinicName = config?.clinicName || 'MaisSaúdeBR'

  const { start, end } = getDateRangeUTC(isToday ? 0 : 1)

  const appointments = await prisma.appointment.findMany({
    where: {
      startTime: { gte: start, lte: end },
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
    },
    include: {
      patient: { select: { fullName: true, phone: true, email: true } },
      doctor:  { select: { specialty: true, user: { select: { name: true } } } },
    },
  })

  console.log(`[Lembretes ${label}] ${appointments.length} consulta(s) encontrada(s)`)

  for (const apt of appointments) {
    const patientName = apt.patient.fullName
    const doctorName  = apt.doctor.user?.name || 'Médico(a)'
    const dateStr     = apt.startTime.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Manaus' })
    const timeStr     = apt.startTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Manaus' })

    const quando  = isToday ? 'HOJE' : 'amanhã'
    const waMsg   = `Olá, ${patientName}! 👋\n\nLembrete da sua consulta *${quando}* às *${timeStr}* com Dr(a). *${doctorName}*.\n\n📅 Data: ${dateStr}\n🏥 ${clinicName}\n\nEm caso de dúvidas ou cancelamento, entre em contato.`

    const [waSent, emailSent] = await Promise.all([
      sendWhatsApp(apt.patient.phone, waMsg),
      sendEmail({ to: apt.patient.email || '', patientName, doctorName, dateStr, timeStr, clinicName, isToday }),
    ])

    console.log(`[Lembretes ${label}] ${patientName} — WhatsApp: ${waSent ? '✓' : '✗'} | Email: ${emailSent ? '✓' : '✗'}`)
  }

  console.log(`[Lembretes ${label}] Concluído.`)
}

export { runReminders }

export function startReminderJobs() {
  // D-1: dispara às 8h do dia anterior à consulta
  cron.schedule('0 8 * * *', () => runReminders(false), { timezone: 'America/Manaus' })
  // D-0: dispara às 7h no dia da consulta
  cron.schedule('0 7 * * *', () => runReminders(true),  { timezone: 'America/Manaus' })

  console.log('[Lembretes] Jobs agendados: D-1 às 8h e D-0 às 7h (America/Manaus)')
}
