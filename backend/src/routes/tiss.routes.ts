import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma2";
import { requireRole } from "../plugins/auth";
import { gerarXmlTiss } from "../lib/tiss-xml";

const requireAuth = requireRole("ADMIN", "RECEPTIONIST");

// ─── Schemas ──────────────────────────────────────────────────────────────────

const guiaSchema = z.object({
  insurancePlanId:            z.string(),
  appointmentId:              z.string().optional(),
  tipo:                       z.enum(["CONSULTA", "SP_SADT"]),
  nomeBeneficiario:           z.string().min(1),
  numeroCarteirinha:          z.string().min(1),
  validadeCarteirinha:        z.string().optional(),
  valorApresentado:           z.number().nonnegative(),
  tipoConsulta:               z.number().int().min(1).max(3).optional(),
  tussCode:                   z.string().optional(),
  cbos:                       z.string().optional(),
  crmExecutante:              z.string().optional(),
  crmEstado:                  z.string().optional(),
  nomeExecutante:             z.string().optional(),
  indicacaoAcidente:          z.number().int().optional(),
  codigoPrestadorNaOperadora: z.string().optional(),
  numeroAutorizacao:          z.string().optional(),
  dataAutorizacao:            z.string().datetime().optional(),
  procedimentos: z.array(z.object({
    tussCode:      z.string(),
    descricao:     z.string(),
    quantidade:    z.number().nonnegative(),
    valorUnitario: z.number().nonnegative(),
    valorTotal:    z.number().nonnegative(),
  })).optional(),
});

const loteSchema = z.object({
  insurancePlanId: z.string(),
  competencia:     z.string().regex(/^\d{4}-\d{2}$/, "Formato YYYY-MM"),
  observacoes:     z.string().optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function proximoNumeroGuia(insurancePlanId: string): Promise<string> {
  const count = await prisma.guiaFaturamento.count({ where: { insurancePlanId } });
  return String(count + 1).padStart(6, "0");
}

async function proximoNumeroLote(insurancePlanId: string): Promise<number> {
  const last = await prisma.loteFaturamento.findFirst({
    where: { insurancePlanId },
    orderBy: { numeroLote: "desc" },
  });
  return (last?.numeroLote ?? 0) + 1;
}

// ─── Rotas ────────────────────────────────────────────────────────────────────

export async function tissRoutes(app: FastifyInstance) {

  // ── Criar guia manualmente ────────────────────────────────────────────────
  app.post("/tiss/guias", { preHandler: [requireAuth] }, async (req, reply) => {
    const data = guiaSchema.parse(req.body);
    const numeroGuia = await proximoNumeroGuia(data.insurancePlanId);

    const { procedimentos, dataAutorizacao, ...rest } = data;

    const guia = await prisma.guiaFaturamento.create({
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
    const { appointmentId } = req.params as { appointmentId: string };

    const existing = await prisma.guiaFaturamento.findUnique({ where: { appointmentId } });
    if (existing) return reply.status(409).send({ error: "Guia já existe para esta consulta" });

    const apt = await prisma.appointment.findUniqueOrThrow({
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

    const contract = await prisma.insuranceContract.findFirst({
      where: {
        planId: apt.insurancePlanId,
        startDate: { lte: apt.startTime },
        OR: [{ endDate: null }, { endDate: { gte: apt.startTime } }],
      },
      orderBy: { startDate: "desc" },
    });

    const valor = apt.payment?.amount ?? contract?.consultationFee ?? apt.doctor.consultationFee ?? 0;
    const numeroGuia = await proximoNumeroGuia(apt.insurancePlanId);

    const guia = await prisma.guiaFaturamento.create({
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
    const { planId, status, loteId, sem_lote } = req.query as Record<string, string>;
    const guias = await prisma.guiaFaturamento.findMany({
      where: {
        ...(planId   && { insurancePlanId: planId }),
        ...(status   && { status: status as any }),
        ...(loteId   && { loteId }),
        ...(sem_lote === "true" && { loteId: null }),
      },
      include: { procedimentos: true, plan: true, appointment: { include: { patient: true, doctor: { include: { user: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    return reply.send(guias);
  });

  // ── Buscar guia ───────────────────────────────────────────────────────────
  app.get("/tiss/guias/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const guia = await prisma.guiaFaturamento.findUniqueOrThrow({
      where: { id },
      include: { procedimentos: true, plan: true, lote: true },
    });
    return reply.send(guia);
  });

  // ── Atualizar guia ────────────────────────────────────────────────────────
  app.patch("/tiss/guias/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = guiaSchema.partial().omit({ insurancePlanId: true, appointmentId: true, procedimentos: true }).parse(req.body);
    const guia = await prisma.guiaFaturamento.update({
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
    const { id } = req.params as { id: string };
    await prisma.guiaFaturamento.delete({ where: { id } });
    return reply.status(204).send();
  });

  // ── Criar lote ────────────────────────────────────────────────────────────
  app.post("/tiss/lotes", { preHandler: [requireAuth] }, async (req, reply) => {
    const data = loteSchema.parse(req.body);
    const numeroLote = await proximoNumeroLote(data.insurancePlanId);
    const lote = await prisma.loteFaturamento.create({
      data: { ...data, numeroLote },
      include: { plan: true, guias: true },
    });
    return reply.status(201).send(lote);
  });

  // ── Listar lotes ──────────────────────────────────────────────────────────
  app.get("/tiss/lotes", { preHandler: [requireAuth] }, async (req, reply) => {
    const { planId } = req.query as { planId?: string };
    const lotes = await prisma.loteFaturamento.findMany({
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
    const { id } = req.params as { id: string };
    const body = z.object({
      status:      z.enum(["ABERTO", "FECHADO", "ENVIADO", "LIQUIDADO"]).optional(),
      observacoes: z.string().optional(),
      dataEnvio:   z.string().datetime().optional(),
      addGuiaIds:  z.array(z.string()).optional(),
      removeGuiaIds: z.array(z.string()).optional(),
    }).parse(req.body);

    // Adiciona guias ao lote
    if (body.addGuiaIds?.length) {
      await prisma.guiaFaturamento.updateMany({
        where: { id: { in: body.addGuiaIds } },
        data: { loteId: id, status: "FATURADA" },
      });
    }

    // Remove guias do lote
    if (body.removeGuiaIds?.length) {
      await prisma.guiaFaturamento.updateMany({
        where: { id: { in: body.removeGuiaIds }, loteId: id },
        data: { loteId: null, status: "PENDENTE" },
      });
    }

    // Recalcula valorTotal
    const total = await prisma.guiaFaturamento.aggregate({
      where: { loteId: id },
      _sum: { valorApresentado: true },
    });

    const lote = await prisma.loteFaturamento.update({
      where: { id },
      data: {
        ...(body.status      && { status: body.status }),
        ...(body.observacoes && { observacoes: body.observacoes }),
        ...(body.dataEnvio   && { dataEnvio: new Date(body.dataEnvio) }),
        valorTotal: total._sum.valorApresentado ?? 0,
      },
      include: { plan: true, guias: { include: { procedimentos: true } } },
    });
    return reply.send(lote);
  });

  // ── Excluir lote ──────────────────────────────────────────────────────────
  app.delete("/tiss/lotes/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    // Desvincula guias antes de excluir
    await prisma.guiaFaturamento.updateMany({
      where: { loteId: id },
      data: { loteId: null, status: "PENDENTE" },
    });
    await prisma.loteFaturamento.delete({ where: { id } });
    return reply.status(204).send();
  });

  // ── Gerar XML TISS 3.05 ───────────────────────────────────────────────────
  app.get("/tiss/lotes/:id/xml", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };

    const lote = await prisma.loteFaturamento.findUniqueOrThrow({
      where: { id },
      include: {
        plan: true,
        guias: { include: { procedimentos: true } },
      },
    });

    const config = await prisma.config.findFirst();

    const guiasConsulta = lote.guias
      .filter(g => g.tipo === "CONSULTA")
      .map(g => ({
        numeroGuia:                 g.numeroGuia,
        numeroAutorizacao:          g.numeroAutorizacao ?? undefined,
        dataAtendimento:            (g as any).appointment?.startTime
                                      ? new Date((g as any).appointment.startTime).toISOString().substring(0, 10)
                                      : new Date(g.createdAt).toISOString().substring(0, 10),
        nomeBeneficiario:           g.nomeBeneficiario,
        numeroCarteirinha:          g.numeroCarteirinha,
        validadeCarteirinha:        g.validadeCarteirinha ?? undefined,
        tipoConsulta:               g.tipoConsulta ?? 1,
        indicacaoAcidente:          g.indicacaoAcidente,
        valorConsulta:              g.valorApresentado,
        tussCode:                   g.tussCode ?? undefined,
        nomeExecutante:             g.nomeExecutante ?? "",
        crmExecutante:              g.crmExecutante ?? "",
        crmEstado:                  g.crmEstado ?? "",
        cbos:                       g.cbos ?? undefined,
        codigoPrestador:            g.codigoPrestadorNaOperadora ?? lote.plan.codigoPrestadorNaOperadora ?? undefined,
      }));

    const guiasSPSADT = lote.guias
      .filter(g => g.tipo === "SP_SADT")
      .map(g => ({
        numeroGuia:                 g.numeroGuia,
        numeroAutorizacao:          g.numeroAutorizacao ?? undefined,
        dataAtendimento:            new Date(g.createdAt).toISOString().substring(0, 10),
        nomeBeneficiario:           g.nomeBeneficiario,
        numeroCarteirinha:          g.numeroCarteirinha,
        validadeCarteirinha:        g.validadeCarteirinha ?? undefined,
        indicacaoAcidente:          g.indicacaoAcidente,
        nomeExecutante:             g.nomeExecutante ?? "",
        crmExecutante:              g.crmExecutante ?? "",
        crmEstado:                  g.crmEstado ?? "",
        cbos:                       g.cbos ?? undefined,
        codigoPrestador:            g.codigoPrestadorNaOperadora ?? lote.plan.codigoPrestadorNaOperadora ?? undefined,
        procedimentos:              g.procedimentos.map(p => ({
          tussCode:      p.tussCode,
          descricao:     p.descricao,
          quantidade:    p.quantidade,
          valorUnitario: p.valorUnitario,
          valorTotal:    p.valorTotal,
        })),
        valorTotal: g.valorApresentado,
      }));

    const xml = gerarXmlTiss({
      numeroLote:    lote.numeroLote,
      competencia:   lote.competencia,
      operadora: {
        registroANS:     lote.plan.ansCode ?? "",
        codigoPrestador: lote.plan.codigoPrestadorNaOperadora ?? "",
      },
      clinica: {
        cnpj:        config?.cnpj ?? "",
        cnes:        config?.cnes ?? "",
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
    const { planId } = req.query as { planId?: string };
    const apts = await prisma.appointment.findMany({
      where: {
        status: "COMPLETED",
        insurancePlanId: { not: null },
        ...(planId && { insurancePlanId: planId }),
        guia: null,
      },
      include: {
        patient: true,
        doctor:  { include: { user: true } },
        insurancePlan: true,
        payment: true,
      },
      orderBy: { startTime: "desc" },
      take: 200,
    });
    return reply.send(apts);
  });
}
