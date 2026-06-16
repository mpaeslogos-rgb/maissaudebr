import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma2'
import { requireRole } from '../plugins/auth'

const requireAuth = requireRole('ADMIN', 'DOCTOR', 'RECEPTIONIST')

function startOf(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}
function endOf(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}
function daysAgo(base: Date, days: number) {
  const d = new Date(base)
  d.setDate(d.getDate() - days)
  return d
}

export async function analyticsRoutes(app: FastifyInstance) {
  /**
   * GET /analytics/unit-economics?from=YYYY-MM-DD&to=YYYY-MM-DD
   */
  app.get('/analytics/unit-economics', { preHandler: [requireAuth] }, async (req, reply) => {
    const { from, to } = req.query as { from?: string; to?: string }

    const fromDate = from ? startOf(new Date(from)) : startOf(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
    const toDate   = to   ? endOf(new Date(to))     : endOf(new Date())

    // ── Receitas pagas no período ──────────────────────────────────────────────
    const payments = await prisma.payment.findMany({
      where: { status: 'PAID', paidAt: { gte: fromDate, lte: toDate } },
      include: {
        appointment: { include: { insurancePlan: { select: { id: true, name: true } } } },
        enrollment:  { include: { program: { select: { id: true, name: true } } } },
      },
    })

    const totalReceita        = payments.reduce((s, p) => s + p.amount, 0)
    const receitaParticular   = payments.filter(p => p.appointment && !p.appointment.insurancePlanId && !p.enrollmentId).reduce((s, p) => s + p.amount, 0)
    const receitaConvenio     = payments.filter(p => p.appointment?.insurancePlanId).reduce((s, p) => s + p.amount, 0)
    const receitaAssinatura   = payments.filter(p => p.enrollmentId).reduce((s, p) => s + p.amount, 0)
    const receitaExames       = payments.filter(p => !p.appointmentId && !p.enrollmentId).reduce((s, p) => s + p.amount, 0)

    // Guias TISS liquidadas
    const guias = await prisma.guiaFaturamento.findMany({
      where: { status: 'PAGA', updatedAt: { gte: fromDate, lte: toDate } },
    })
    const receitaTiss = guias.reduce((s, g) => s + (g.valorAprovado ?? g.valorApresentado), 0)
    const glosas      = await prisma.guiaFaturamento.findMany({
      where: { status: 'GLOSADA', updatedAt: { gte: fromDate, lte: toDate } },
    })
    const totalGlosas = glosas.reduce((s, g) => s + (g.valorApresentado - (g.valorAprovado ?? g.valorApresentado)), 0)

    const refunds       = await prisma.payment.findMany({ where: { status: 'REFUNDED', updatedAt: { gte: fromDate, lte: toDate } } })
    const totalEstornos = refunds.reduce((s, p) => s + p.amount, 0)

    const receitaBruta   = totalReceita + receitaTiss
    const receitaLiquida = receitaBruta - totalGlosas - totalEstornos

    // ── Repasses médicos ───────────────────────────────────────────────────────
    const doctorPayments = await prisma.doctorPayment.findMany({
      where: { status: 'PAID', paidAt: { gte: fromDate, lte: toDate } },
    })
    const totalRepasses = doctorPayments.reduce((s, d) => s + d.amount, 0)

    // ── Materiais consumidos ───────────────────────────────────────────────────
    const stockOuts = await prisma.stockMovement.findMany({
      where: { type: 'OUT', createdAt: { gte: fromDate, lte: toDate } },
      include: { material: { select: { costPrice: true } } },
    })
    const totalMateriais = stockOuts.reduce((s, m) => s + (m.material.costPrice ?? 0) * m.quantity, 0)

    // ── Despesas pagas ─────────────────────────────────────────────────────────
    const payables = await prisma.accountPayable.findMany({
      where: { status: 'PAID', paidAt: { gte: fromDate, lte: toDate } },
    })
    const despesasPorCategoria: Record<string, number> = {}
    for (const p of payables) {
      const cat = p.category ?? 'Outros'
      despesasPorCategoria[cat] = (despesasPorCategoria[cat] ?? 0) + p.amount
    }
    const totalDespesas = payables.reduce((s, p) => s + p.amount, 0)

    // ── CSP ────────────────────────────────────────────────────────────────────
    const labCat        = ['Laboratório', 'Exame terceirizado', 'Exames terceirizados']
    const examesTerceiros = payables.filter(p => labCat.includes(p.category ?? '')).reduce((s, p) => s + p.amount, 0)
    const totalCSP      = totalRepasses + totalMateriais + examesTerceiros

    const resultadoBruto  = receitaLiquida - totalCSP
    const despesasOp      = totalDespesas - examesTerceiros
    const ebitda          = resultadoBruto - despesasOp
    const resultadoLiquido = ebitda

    // ── Pacientes ativos no período ───────────────────────────────────────────
    const pacientesAtendidos    = new Set(payments.map(p => p.patientId))
    const totalPacientesAtivos  = pacientesAtendidos.size
    const receitaPorPaciente    = totalPacientesAtivos > 0 ? receitaLiquida / totalPacientesAtivos : 0
    const custoPorPaciente      = totalPacientesAtivos > 0 ? totalCSP / totalPacientesAtivos : 0
    const margemPorPaciente     = receitaPorPaciente - custoPorPaciente

    // ── Retenção 30 / 60 / 90 dias ────────────────────────────────────────────
    async function calcRetencao(days: number) {
      const windowStart = daysAgo(toDate, days)
      const before = await prisma.payment.findMany({
        where: { status: 'PAID', paidAt: { gte: windowStart, lt: fromDate } },
        select: { patientId: true },
      })
      const patientsBefore = new Set(before.map(p => p.patientId))
      if (patientsBefore.size === 0) return null
      const retained = [...pacientesAtendidos].filter(id => patientsBefore.has(id)).length
      return Math.round((retained / patientsBefore.size) * 100)
    }

    const [retencao30d, retencao60d, retencao90d] = await Promise.all([
      calcRetencao(30),
      calcRetencao(60),
      calcRetencao(90),
    ])

    // ── Churn mensal ──────────────────────────────────────────────────────────
    const cancelledInPeriod = await prisma.patientEnrollment.count({
      where: { status: 'CANCELLED', cancelledAt: { gte: fromDate, lte: toDate } },
    })
    const activeAtStart = await prisma.patientEnrollment.count({
      where: { status: { in: ['ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED'] }, createdAt: { lt: fromDate } },
    })
    const churnMensal = activeAtStart > 0
      ? +((cancelledInPeriod / activeAtStart) * 100).toFixed(1)
      : null

    // ── Consultas no período ──────────────────────────────────────────────────
    const appointments = await prisma.appointment.findMany({
      where: { startTime: { gte: fromDate, lte: toDate }, status: { not: 'CANCELLED' } },
      include: { doctor: { select: { id: true } } },
    })
    const totalConsultas = appointments.length
    const noShows        = appointments.filter(a => a.status === 'NO_SHOW').length
    const ticketMedio    = totalConsultas > 0 ? receitaParticular / Math.max(totalConsultas - noShows, 1) : 0

    // ── Pacientes por profissional ─────────────────────────────────────────────
    const activeEnrollmentsByDoctor = await prisma.appointment.findMany({
      where: { startTime: { gte: fromDate, lte: toDate }, status: { not: 'CANCELLED' } },
      select: { doctorId: true, patientId: true },
    })
    const doctorPatientMap: Record<string, Set<string>> = {}
    for (const a of activeEnrollmentsByDoctor) {
      if (!doctorPatientMap[a.doctorId]) doctorPatientMap[a.doctorId] = new Set()
      doctorPatientMap[a.doctorId].add(a.patientId)
    }
    const doctorCount = Object.keys(doctorPatientMap).length
    const pacientesPorProfissional = doctorCount > 0
      ? +(totalPacientesAtivos / doctorCount).toFixed(1)
      : null

    // ── Completude dos dados (pacientes elegíveis com ficha completa) ──────────
    const totalPatients = await prisma.patient.count({ where: { deletedAt: null } })
    const completePatients = await prisma.patient.count({
      where: {
        deletedAt:  null,
        cpf:        { not: null },
        birthDate:  { not: null },
        phone:      { not: '' },
        riskProfile: { not: 'NONE' },
      },
    })
    const completudeDados = totalPatients > 0
      ? Math.round((completePatients / totalPatients) * 100)
      : null

    // ── Matrículas ativas — por programa ──────────────────────────────────────
    const enrollments = await prisma.patientEnrollment.findMany({
      where: { status: 'ACTIVE' },
      include: { program: { select: { id: true, name: true } } },
    })
    const mrr = enrollments.reduce((s, e) => s + e.monthlyFee, 0)

    // Unit economics por programa
    const programMap: Record<string, { nome: string; count: number; mrr: number; patientIds: Set<string> }> = {}
    for (const e of enrollments) {
      const key = e.programId
      if (!programMap[key]) programMap[key] = { nome: e.program.name, count: 0, mrr: 0, patientIds: new Set() }
      programMap[key].count++
      programMap[key].mrr += e.monthlyFee
      programMap[key].patientIds.add(e.patientId)
    }
    // Receita de assinatura por programa no período
    const assinaturaPorPrograma = Object.entries(programMap).map(([programId, d]) => {
      const receitaPrograma = payments
        .filter(p => p.enrollmentId && enrollments.find(e => e.id === p.enrollmentId)?.programId === programId)
        .reduce((s, p) => s + p.amount, 0)
      const pacientesPrograma = d.patientIds.size
      return {
        programId,
        nome:                d.nome,
        matriculasAtivas:    d.count,
        mrr:                 +d.mrr.toFixed(2),
        receitaPeriodo:      +receitaPrograma.toFixed(2),
        receitaPorPaciente:  pacientesPrograma > 0 ? +(receitaPrograma / pacientesPrograma).toFixed(2) : 0,
      }
    })

    // ── NPS ───────────────────────────────────────────────────────────────────
    const npsResps = await prisma.npsResponse.findMany({
      where: { respondedAt: { gte: fromDate, lte: toDate }, NOT: { respondedAt: null } },
      select: { score: true },
    })
    const npsTotal = npsResps.length
    const npsScore = npsTotal > 0
      ? Math.round(((npsResps.filter(r => r.score >= 9).length - npsResps.filter(r => r.score <= 6).length) / npsTotal) * 100)
      : null

    // ── Check-ins: taxa de adesão global no período ────────────────────────────
    const checkInsTotal     = await prisma.checkIn.count({ where: { scheduledAt: { gte: fromDate, lte: toDate } } })
    const checkInsConcluidos = await prisma.checkIn.count({
      where: { scheduledAt: { gte: fromDate, lte: toDate }, completedAt: { not: null } },
    })
    const adesaoCheckIns = checkInsTotal > 0
      ? Math.round((checkInsConcluidos / checkInsTotal) * 100)
      : null

    // ── Pacientes elegíveis ────────────────────────────────────────────────────
    const elegiveisCount = await prisma.patient.count({
      where: { deletedAt: null, riskProfile: { in: ['METABOLIC', 'CARDIOMETABOLIC', 'HIGH'] } },
    })
    const semProgramaCount = await prisma.patient.count({
      where: {
        deletedAt:   null,
        riskProfile: { in: ['METABOLIC', 'CARDIOMETABOLIC', 'HIGH'] },
        enrollments: { none: { status: 'ACTIVE' } },
      },
    })
    const taxaConversaoElegiveis = elegiveisCount > 0
      ? Math.round(((elegiveisCount - semProgramaCount) / elegiveisCount) * 100)
      : null

    return reply.send({
      periodo: { from: fromDate, to: toDate },

      dre: {
        receitaBruta,
        deducoes:      { glosas: totalGlosas, estornos: totalEstornos },
        receitaLiquida,
        csp: { total: totalCSP, repasses: totalRepasses, materiais: totalMateriais, examesTerceiros },
        resultadoBruto,
        margemBruta:   receitaLiquida > 0 ? +(resultadoBruto / receitaLiquida * 100).toFixed(1) : 0,
        despesasOperacionais: { total: despesasOp, porCategoria: despesasPorCategoria },
        ebitda,
        margemEbitda:  receitaLiquida > 0 ? +(ebitda / receitaLiquida * 100).toFixed(1) : 0,
        resultadoLiquido,
        margemLiquida: receitaLiquida > 0 ? +(resultadoLiquido / receitaLiquida * 100).toFixed(1) : 0,
      },

      mix: { particular: receitaParticular, convenio: receitaConvenio, assinatura: receitaAssinatura, exames: receitaExames, tiss: receitaTiss },

      unitEconomics: {
        totalPacientesAtivos,
        receitaPorPaciente:      +receitaPorPaciente.toFixed(2),
        custoPorPaciente:        +custoPorPaciente.toFixed(2),
        margemPorPaciente:       +margemPorPaciente.toFixed(2),
        retencao30d,
        retencao60d,
        retencao90d,
        churnMensal,
        ticketMedioConsulta:     +ticketMedio.toFixed(2),
        totalConsultas,
        noShows,
        pacientesPorProfissional,
      },

      assinaturas: {
        mrr: +mrr.toFixed(2),
        totalAtivas:    enrollments.length,
        programas:      assinaturaPorPrograma,
      },

      pilotos: {
        elegiveisCount,
        semProgramaCount,
        taxaConversaoElegiveis,
        adesaoCheckInsPct: adesaoCheckIns,
        checkInsTotal,
        checkInsConcluidos,
        completudeDadosPct: completudeDados,
        totalPacientesCadastrados: totalPatients,
        pacientesComFichaCompleta: completePatients,
      },

      nps:         { score: npsScore, total: npsTotal },
    })
  })
}
