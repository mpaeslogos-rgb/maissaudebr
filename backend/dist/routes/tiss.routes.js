"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tissRoutes = tissRoutes;
const zod_1 = require("zod");
const prisma2_1 = require("../lib/prisma2");
const auth_1 = require("../plugins/auth");
const tiss_xml_1 = require("../lib/tiss-xml");
const requireAuth = (0, auth_1.requireRole)("ADMIN", "RECEPTIONIST");
// ─── Schemas ──────────────────────────────────────────────────────────────────
const guiaSchema = zod_1.z.object({
    insurancePlanId: zod_1.z.string(),
    appointmentId: zod_1.z.string().optional(),
    tipo: zod_1.z.enum(["CONSULTA", "SP_SADT"]),
    nomeBeneficiario: zod_1.z.string().min(1),
    numeroCarteirinha: zod_1.z.string().min(1),
    validadeCarteirinha: zod_1.z.string().optional(),
    valorApresentado: zod_1.z.number().nonnegative(),
    tipoConsulta: zod_1.z.number().int().min(1).max(3).optional(),
    tussCode: zod_1.z.string().optional(),
    cbos: zod_1.z.string().optional(),
    crmExecutante: zod_1.z.string().optional(),
    crmEstado: zod_1.z.string().optional(),
    nomeExecutante: zod_1.z.string().optional(),
    indicacaoAcidente: zod_1.z.number().int().optional(),
    codigoPrestadorNaOperadora: zod_1.z.string().optional(),
    numeroAutorizacao: zod_1.z.string().optional(),
    dataAutorizacao: zod_1.z.string().datetime().optional(),
    procedimentos: zod_1.z.array(zod_1.z.object({
        tussCode: zod_1.z.string(),
        descricao: zod_1.z.string(),
        quantidade: zod_1.z.number().nonnegative(),
        valorUnitario: zod_1.z.number().nonnegative(),
        valorTotal: zod_1.z.number().nonnegative(),
    })).optional(),
});
const loteSchema = zod_1.z.object({
    insurancePlanId: zod_1.z.string(),
    competencia: zod_1.z.string().regex(/^\d{4}-\d{2}$/, "Formato YYYY-MM"),
    observacoes: zod_1.z.string().optional(),
});
// ─── Helpers ──────────────────────────────────────────────────────────────────
async function proximoNumeroGuia(insurancePlanId) {
    const count = await prisma2_1.prisma.guiaFaturamento.count({ where: { insurancePlanId } });
    return String(count + 1).padStart(6, "0");
}
async function proximoNumeroLote(insurancePlanId) {
    const last = await prisma2_1.prisma.loteFaturamento.findFirst({
        where: { insurancePlanId },
        orderBy: { numeroLote: "desc" },
    });
    return (last?.numeroLote ?? 0) + 1;
}
// ─── Rotas ────────────────────────────────────────────────────────────────────
async function tissRoutes(app) {
    // ── Criar guia manualmente ────────────────────────────────────────────────
    app.post("/tiss/guias", { preHandler: [requireAuth] }, async (req, reply) => {
        const data = guiaSchema.parse(req.body);
        const numeroGuia = await proximoNumeroGuia(data.insurancePlanId);
        const { procedimentos, dataAutorizacao, ...rest } = data;
        const guia = await prisma2_1.prisma.guiaFaturamento.create({
            data: {
                ...rest,
                numeroGuia,
                indicacaoAcidente: rest.indicacaoAcidente ?? 9,
                ...(dataAutorizacao && { dataAutorizacao: new Date(dataAutorizacao) }),
                ...(procedimentos?.length && {
                    procedimentos: { create: procedimentos },
                }),
            },
            include: { procedimentos: true },
        });
        return reply.status(201).send(guia);
    });
    // ── Criar guia a partir de uma consulta (agendamento) ────────────────────
    app.post("/tiss/guias/from-appointment/:appointmentId", { preHandler: [requireAuth] }, async (req, reply) => {
        const { appointmentId } = req.params;
        const existing = await prisma2_1.prisma.guiaFaturamento.findUnique({ where: { appointmentId } });
        if (existing)
            return reply.status(409).send({ error: "Guia já existe para esta consulta" });
        const apt = await prisma2_1.prisma.appointment.findUniqueOrThrow({
            where: { id: appointmentId },
            include: {
                patient: true,
                doctor: { include: { user: true } },
                insurancePlan: true,
                payment: true,
            },
        });
        if (!apt.insurancePlanId || !apt.insurancePlan) {
            return reply.status(422).send({ error: "Agendamento não possui convênio vinculado" });
        }
        const contract = await prisma2_1.prisma.insuranceContract.findFirst({
            where: {
                planId: apt.insurancePlanId,
                startDate: { lte: apt.startTime },
                OR: [{ endDate: null }, { endDate: { gte: apt.startTime } }],
            },
            orderBy: { startDate: "desc" },
        });
        const valor = apt.payment?.amount ?? contract?.consultationFee ?? apt.doctor.consultationFee ?? 0;
        const numeroGuia = await proximoNumeroGuia(apt.insurancePlanId);
        const guia = await prisma2_1.prisma.guiaFaturamento.create({
            data: {
                insurancePlanId: apt.insurancePlanId,
                appointmentId,
                tipo: "CONSULTA",
                numeroGuia,
                nomeBeneficiario: apt.patient.fullName,
                numeroCarteirinha: apt.patient.healthInsuranceNumber ?? "",
                valorApresentado: valor,
                tipoConsulta: apt.isReturn ? 2 : 1,
                nomeExecutante: apt.doctor.user.name,
                crmExecutante: apt.doctor.crm,
                crmEstado: apt.doctor.crmState,
                indicacaoAcidente: 9,
                codigoPrestadorNaOperadora: apt.insurancePlan.codigoPrestadorNaOperadora ?? undefined,
            },
            include: { procedimentos: true, plan: true },
        });
        return reply.status(201).send(guia);
    });
    // ── Listar guias ──────────────────────────────────────────────────────────
    app.get("/tiss/guias", { preHandler: [requireAuth] }, async (req, reply) => {
        const { planId, status, loteId, sem_lote } = req.query;
        const guias = await prisma2_1.prisma.guiaFaturamento.findMany({
            where: {
                ...(planId && { insurancePlanId: planId }),
                ...(status && { status: status }),
                ...(loteId && { loteId }),
                ...(sem_lote === "true" && { loteId: null }),
            },
            include: { procedimentos: true, plan: true, appointment: { include: { patient: true, doctor: { include: { user: true } } } } },
            orderBy: { createdAt: "desc" },
        });
        return reply.send(guias);
    });
    // ── Buscar guia ───────────────────────────────────────────────────────────
    app.get("/tiss/guias/:id", { preHandler: [requireAuth] }, async (req, reply) => {
        const { id } = req.params;
        const guia = await prisma2_1.prisma.guiaFaturamento.findUniqueOrThrow({
            where: { id },
            include: { procedimentos: true, plan: true, lote: true },
        });
        return reply.send(guia);
    });
    // ── Atualizar guia ────────────────────────────────────────────────────────
    app.patch("/tiss/guias/:id", { preHandler: [requireAuth] }, async (req, reply) => {
        const { id } = req.params;
        const data = guiaSchema.partial().omit({ insurancePlanId: true, appointmentId: true, procedimentos: true }).parse(req.body);
        const guia = await prisma2_1.prisma.guiaFaturamento.update({
            where: { id },
            data: {
                ...data,
                ...(data.dataAutorizacao && { dataAutorizacao: new Date(data.dataAutorizacao) }),
            },
        });
        return reply.send(guia);
    });
    // ── Excluir guia ──────────────────────────────────────────────────────────
    app.delete("/tiss/guias/:id", { preHandler: [requireAuth] }, async (req, reply) => {
        const { id } = req.params;
        await prisma2_1.prisma.guiaFaturamento.delete({ where: { id } });
        return reply.status(204).send();
    });
    // ── Criar lote ────────────────────────────────────────────────────────────
    app.post("/tiss/lotes", { preHandler: [requireAuth] }, async (req, reply) => {
        const data = loteSchema.parse(req.body);
        const numeroLote = await proximoNumeroLote(data.insurancePlanId);
        const lote = await prisma2_1.prisma.loteFaturamento.create({
            data: { ...data, numeroLote },
            include: { plan: true, guias: true },
        });
        return reply.status(201).send(lote);
    });
    // ── Listar lotes ──────────────────────────────────────────────────────────
    app.get("/tiss/lotes", { preHandler: [requireAuth] }, async (req, reply) => {
        const { planId } = req.query;
        const lotes = await prisma2_1.prisma.loteFaturamento.findMany({
            where: { ...(planId && { insurancePlanId: planId }) },
            include: {
                plan: true,
                guias: { include: { procedimentos: true } },
            },
            orderBy: { createdAt: "desc" },
        });
        return reply.send(lotes);
    });
    // ── Atualizar lote (status, adicionar/remover guias) ─────────────────────
    app.patch("/tiss/lotes/:id", { preHandler: [requireAuth] }, async (req, reply) => {
        const { id } = req.params;
        const body = zod_1.z.object({
            status: zod_1.z.enum(["ABERTO", "FECHADO", "ENVIADO", "LIQUIDADO"]).optional(),
            observacoes: zod_1.z.string().optional(),
            dataEnvio: zod_1.z.string().datetime().optional(),
            addGuiaIds: zod_1.z.array(zod_1.z.string()).optional(),
            removeGuiaIds: zod_1.z.array(zod_1.z.string()).optional(),
        }).parse(req.body);
        // Adiciona guias ao lote
        if (body.addGuiaIds?.length) {
            await prisma2_1.prisma.guiaFaturamento.updateMany({
                where: { id: { in: body.addGuiaIds } },
                data: { loteId: id, status: "FATURADA" },
            });
        }
        // Remove guias do lote
        if (body.removeGuiaIds?.length) {
            await prisma2_1.prisma.guiaFaturamento.updateMany({
                where: { id: { in: body.removeGuiaIds }, loteId: id },
                data: { loteId: null, status: "PENDENTE" },
            });
        }
        // Recalcula valorTotal
        const total = await prisma2_1.prisma.guiaFaturamento.aggregate({
            where: { loteId: id },
            _sum: { valorApresentado: true },
        });
        const lote = await prisma2_1.prisma.loteFaturamento.update({
            where: { id },
            data: {
                ...(body.status && { status: body.status }),
                ...(body.observacoes && { observacoes: body.observacoes }),
                ...(body.dataEnvio && { dataEnvio: new Date(body.dataEnvio) }),
                valorTotal: total._sum.valorApresentado ?? 0,
            },
            include: { plan: true, guias: { include: { procedimentos: true } } },
        });
        return reply.send(lote);
    });
    // ── Excluir lote ──────────────────────────────────────────────────────────
    app.delete("/tiss/lotes/:id", { preHandler: [requireAuth] }, async (req, reply) => {
        const { id } = req.params;
        // Desvincula guias antes de excluir
        await prisma2_1.prisma.guiaFaturamento.updateMany({
            where: { loteId: id },
            data: { loteId: null, status: "PENDENTE" },
        });
        await prisma2_1.prisma.loteFaturamento.delete({ where: { id } });
        return reply.status(204).send();
    });
    // ── Gerar XML TISS 3.05 ───────────────────────────────────────────────────
    app.get("/tiss/lotes/:id/xml", { preHandler: [requireAuth] }, async (req, reply) => {
        const { id } = req.params;
        const lote = await prisma2_1.prisma.loteFaturamento.findUniqueOrThrow({
            where: { id },
            include: {
                plan: true,
                guias: { include: { procedimentos: true } },
            },
        });
        const config = await prisma2_1.prisma.config.findFirst();
        const guiasConsulta = lote.guias
            .filter(g => g.tipo === "CONSULTA")
            .map(g => ({
            numeroGuia: g.numeroGuia,
            numeroAutorizacao: g.numeroAutorizacao ?? undefined,
            dataAtendimento: g.appointment?.startTime
                ? new Date(g.appointment.startTime).toISOString().substring(0, 10)
                : new Date(g.createdAt).toISOString().substring(0, 10),
            nomeBeneficiario: g.nomeBeneficiario,
            numeroCarteirinha: g.numeroCarteirinha,
            validadeCarteirinha: g.validadeCarteirinha ?? undefined,
            tipoConsulta: g.tipoConsulta ?? 1,
            indicacaoAcidente: g.indicacaoAcidente,
            valorConsulta: g.valorApresentado,
            tussCode: g.tussCode ?? undefined,
            nomeExecutante: g.nomeExecutante ?? "",
            crmExecutante: g.crmExecutante ?? "",
            crmEstado: g.crmEstado ?? "",
            cbos: g.cbos ?? undefined,
            codigoPrestador: g.codigoPrestadorNaOperadora ?? lote.plan.codigoPrestadorNaOperadora ?? undefined,
        }));
        const guiasSPSADT = lote.guias
            .filter(g => g.tipo === "SP_SADT")
            .map(g => ({
            numeroGuia: g.numeroGuia,
            numeroAutorizacao: g.numeroAutorizacao ?? undefined,
            dataAtendimento: new Date(g.createdAt).toISOString().substring(0, 10),
            nomeBeneficiario: g.nomeBeneficiario,
            numeroCarteirinha: g.numeroCarteirinha,
            validadeCarteirinha: g.validadeCarteirinha ?? undefined,
            indicacaoAcidente: g.indicacaoAcidente,
            nomeExecutante: g.nomeExecutante ?? "",
            crmExecutante: g.crmExecutante ?? "",
            crmEstado: g.crmEstado ?? "",
            cbos: g.cbos ?? undefined,
            codigoPrestador: g.codigoPrestadorNaOperadora ?? lote.plan.codigoPrestadorNaOperadora ?? undefined,
            procedimentos: g.procedimentos.map(p => ({
                tussCode: p.tussCode,
                descricao: p.descricao,
                quantidade: p.quantidade,
                valorUnitario: p.valorUnitario,
                valorTotal: p.valorTotal,
            })),
            valorTotal: g.valorApresentado,
        }));
        const xml = (0, tiss_xml_1.gerarXmlTiss)({
            numeroLote: lote.numeroLote,
            competencia: lote.competencia,
            operadora: {
                registroANS: lote.plan.ansCode ?? "",
                codigoPrestador: lote.plan.codigoPrestadorNaOperadora ?? "",
            },
            clinica: {
                cnpj: config?.cnpj ?? "",
                cnes: config?.cnes ?? "",
                razaoSocial: config?.clinicName ?? "",
            },
            guiasConsulta,
            guiasSPSADT,
        });
        const filename = `tiss_lote_${lote.numeroLote}_${lote.competencia}.xml`;
        reply
            .header("Content-Type", "application/xml; charset=UTF-8")
            .header("Content-Disposition", `attachment; filename="${filename}"`)
            .send(xml);
    });
    // ── Consultas elegíveis (sem guia, com convênio, COMPLETED) ─────────────
    app.get("/tiss/consultas-elegiveis", { preHandler: [requireAuth] }, async (req, reply) => {
        const { planId } = req.query;
        const apts = await prisma2_1.prisma.appointment.findMany({
            where: {
                status: "COMPLETED",
                insurancePlanId: { not: null },
                ...(planId && { insurancePlanId: planId }),
                guia: null,
            },
            include: {
                patient: true,
                doctor: { include: { user: true } },
                insurancePlan: true,
                payment: true,
            },
            orderBy: { startTime: "desc" },
            take: 200,
        });
        return reply.send(apts);
    });
}
