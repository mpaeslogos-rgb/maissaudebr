"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsRoutes = analyticsRoutes;
const prisma2_1 = require("../lib/prisma2");
const auth_1 = require("../plugins/auth");
const requireAuth = (0, auth_1.requireRole)('ADMIN', 'DOCTOR', 'RECEPTIONIST');
function startOf(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}
function endOf(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}
async function analyticsRoutes(app) {
    /**
     * GET /api/analytics/unit-economics?from=YYYY-MM-DD&to=YYYY-MM-DD
     * Retorna KPIs de unit economics para o período.
     */
    app.get('/analytics/unit-economics', { preHandler: [requireAuth] }, async (req, reply) => {
        const { from, to } = req.query;
        const fromDate = from ? startOf(new Date(from)) : startOf(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
        const toDate = to ? endOf(new Date(to)) : endOf(new Date());
        // ── Receitas pagas no período ──────────────────────────────────────────────
        const payments = await prisma2_1.prisma.payment.findMany({
            where: { status: 'PAID', paidAt: { gte: fromDate, lte: toDate } },
            include: {
                appointment: { include: { insurancePlan: { select: { id: true, name: true } } } },
                enrollment: { include: { program: { select: { id: true, name: true } } } },
            },
        });
        const totalReceita = payments.reduce((s, p) => s + p.amount, 0);
        const receitaParticular = payments.filter(p => p.appointment && !p.appointment.insurancePlanId && !p.enrollmentId).reduce((s, p) => s + p.amount, 0);
        const receitaConvenio = payments.filter(p => p.appointment?.insurancePlanId).reduce((s, p) => s + p.amount, 0);
        const receitaAssinatura = payments.filter(p => p.enrollmentId).reduce((s, p) => s + p.amount, 0);
        const receitaExames = payments.filter(p => !p.appointmentId && !p.enrollmentId).reduce((s, p) => s + p.amount, 0);
        // Guias TISS liquidadas no período
        const guias = await prisma2_1.prisma.guiaFaturamento.findMany({
            where: { status: 'PAGA', updatedAt: { gte: fromDate, lte: toDate } },
        });
        const receitaTiss = guias.reduce((s, g) => s + (g.valorAprovado ?? g.valorApresentado), 0);
        const glosas = await prisma2_1.prisma.guiaFaturamento.findMany({
            where: { status: 'GLOSADA', updatedAt: { gte: fromDate, lte: toDate } },
        });
        const totalGlosas = glosas.reduce((s, g) => s + (g.valorApresentado - (g.valorAprovado ?? g.valorApresentado)), 0);
        // Estornos
        const refunds = await prisma2_1.prisma.payment.findMany({
            where: { status: 'REFUNDED', updatedAt: { gte: fromDate, lte: toDate } },
        });
        const totalEstornos = refunds.reduce((s, p) => s + p.amount, 0);
        const receitaBruta = totalReceita + receitaTiss;
        const receitaLiquida = receitaBruta - totalGlosas - totalEstornos;
        // ── Repasses médicos ───────────────────────────────────────────────────────
        const doctorPayments = await prisma2_1.prisma.doctorPayment.findMany({
            where: { status: 'PAID', paidAt: { gte: fromDate, lte: toDate } },
        });
        const totalRepasses = doctorPayments.reduce((s, d) => s + d.amount, 0);
        // ── Materiais consumidos ───────────────────────────────────────────────────
        const stockOuts = await prisma2_1.prisma.stockMovement.findMany({
            where: { type: 'OUT', createdAt: { gte: fromDate, lte: toDate } },
            include: { material: { select: { costPrice: true } } },
        });
        const totalMateriais = stockOuts.reduce((s, m) => s + (m.material.costPrice ?? 0) * m.quantity, 0);
        // ── Despesas pagas no período ──────────────────────────────────────────────
        const payables = await prisma2_1.prisma.accountPayable.findMany({
            where: { status: 'PAID', paidAt: { gte: fromDate, lte: toDate } },
        });
        // Mapa por categoria
        const despesasPorCategoria = {};
        for (const p of payables) {
            const cat = p.category ?? 'Outros';
            despesasPorCategoria[cat] = (despesasPorCategoria[cat] ?? 0) + p.amount;
        }
        const totalDespesas = payables.reduce((s, p) => s + p.amount, 0);
        // ── CSP (Custo dos Serviços Prestados) ────────────────────────────────────
        const labCat = ['Laboratório', 'Exame terceirizado', 'Exames terceirizados'];
        const examesTerceiros = payables.filter(p => labCat.includes(p.category ?? '')).reduce((s, p) => s + p.amount, 0);
        const totalCSP = totalRepasses + totalMateriais + examesTerceiros;
        // ── Resultado ─────────────────────────────────────────────────────────────
        const resultadoBruto = receitaLiquida - totalCSP;
        const despesasOp = totalDespesas - examesTerceiros;
        const ebitda = resultadoBruto - despesasOp;
        const resultadoLiquido = ebitda;
        // ── Pacientes ativos no período ───────────────────────────────────────────
        const pacientesAtendidos = new Set(payments.map(p => p.patientId));
        const totalPacientesAtivos = pacientesAtendidos.size;
        const receitaPorPaciente = totalPacientesAtivos > 0 ? receitaLiquida / totalPacientesAtivos : 0;
        const custoPorPaciente = totalPacientesAtivos > 0 ? totalCSP / totalPacientesAtivos : 0;
        const margemPorPaciente = receitaPorPaciente - custoPorPaciente;
        // ── Retenção 90 dias ──────────────────────────────────────────────────────
        const ninetyDaysAgo = new Date(toDate);
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const paymentsBefore = await prisma2_1.prisma.payment.findMany({
            where: { status: 'PAID', paidAt: { gte: ninetyDaysAgo, lt: fromDate } },
            select: { patientId: true },
        });
        const patientsBefore = new Set(paymentsBefore.map(p => p.patientId));
        const retidos = [...pacientesAtendidos].filter(id => patientsBefore.has(id)).length;
        const retencao90d = patientsBefore.size > 0
            ? Math.round((retidos / patientsBefore.size) * 100)
            : null;
        // ── Consultas no período ──────────────────────────────────────────────────
        const appointments = await prisma2_1.prisma.appointment.findMany({
            where: { startTime: { gte: fromDate, lte: toDate }, status: { not: 'CANCELLED' } },
        });
        const totalConsultas = appointments.length;
        const noShows = appointments.filter(a => a.status === 'NO_SHOW').length;
        const ticketMedio = totalConsultas > 0 ? receitaParticular / Math.max(totalConsultas - noShows, 1) : 0;
        // ── Matrículas ativas ─────────────────────────────────────────────────────
        const enrollments = await prisma2_1.prisma.patientEnrollment.findMany({
            where: { status: 'ACTIVE' },
            include: { program: { select: { name: true } } },
        });
        const mrr = enrollments.reduce((s, e) => s + e.monthlyFee, 0);
        // ── NPS ───────────────────────────────────────────────────────────────────
        const npsResps = await prisma2_1.prisma.npsResponse.findMany({
            where: { respondedAt: { gte: fromDate, lte: toDate }, NOT: { respondedAt: null } },
            select: { score: true },
        });
        const npsTotal = npsResps.length;
        const npsScore = npsTotal > 0
            ? Math.round(((npsResps.filter(r => r.score >= 9).length - npsResps.filter(r => r.score <= 6).length) / npsTotal) * 100)
            : null;
        return reply.send({
            periodo: { from: fromDate, to: toDate },
            // DRE Clínica
            dre: {
                receitaBruta,
                deducoes: { glosas: totalGlosas, estornos: totalEstornos },
                receitaLiquida,
                csp: {
                    total: totalCSP,
                    repasses: totalRepasses,
                    materiais: totalMateriais,
                    examesTerceiros,
                },
                resultadoBruto,
                margemBruta: receitaLiquida > 0 ? +(resultadoBruto / receitaLiquida * 100).toFixed(1) : 0,
                despesasOperacionais: {
                    total: despesasOp,
                    porCategoria: despesasPorCategoria,
                },
                ebitda,
                margemEbitda: receitaLiquida > 0 ? +(ebitda / receitaLiquida * 100).toFixed(1) : 0,
                resultadoLiquido,
                margemLiquida: receitaLiquida > 0 ? +(resultadoLiquido / receitaLiquida * 100).toFixed(1) : 0,
            },
            // Mix de receita
            mix: {
                particular: receitaParticular,
                convenio: receitaConvenio,
                assinatura: receitaAssinatura,
                exames: receitaExames,
                tiss: receitaTiss,
            },
            // Unit economics
            unitEconomics: {
                totalPacientesAtivos,
                receitaPorPaciente: +receitaPorPaciente.toFixed(2),
                custoPorPaciente: +custoPorPaciente.toFixed(2),
                margemPorPaciente: +margemPorPaciente.toFixed(2),
                retencao90d,
                ticketMedioConsulta: +ticketMedio.toFixed(2),
                totalConsultas,
                noShows,
            },
            // Assinaturas
            assinaturas: {
                mrr: +mrr.toFixed(2),
                totalAtivas: enrollments.length,
                programas: Object.entries(enrollments.reduce((acc, e) => {
                    acc[e.program.name] = (acc[e.program.name] ?? 0) + 1;
                    return acc;
                }, {})).map(([nome, count]) => ({ nome, count })),
            },
            // NPS
            nps: { score: npsScore, total: npsTotal },
        });
    });
}
