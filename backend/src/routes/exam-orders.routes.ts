import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma2";
import { requireRole } from "../plugins/auth"

const requireAuth = requireRole('ADMIN', 'DOCTOR', 'RECEPTIONIST');

const createSchema = z.object({
  patientId:       z.string(),
  doctorId:        z.string(),
  catalogId:       z.string(),
  appointmentId:   z.string().optional(),
  insurancePlanId: z.string().optional(),
  scheduledAt:     z.string().datetime().optional(),
  scheduledEnd:    z.string().datetime().optional(),
  notes:           z.string().optional(),
});

// Regra de status automático por horário
function computeStatus(order: {
  status: string;
  scheduledAt: Date | null;
  completedAt: Date | null;
}): string {
  if (order.status === "CANCELLED" || order.status === "COMPLETED") return order.status;
  if (!order.scheduledAt) return "PENDING";
  const now = new Date();
  if (order.scheduledAt > now) return "SCHEDULED";
  return "IN_PROGRESS";
}

async function calcRepasse(catalogId: string, doctorId: string, amount: number): Promise<number> {
  const [catalog, doctor] = await Promise.all([
    prisma.examCatalog.findUnique({ where: { id: catalogId } }),
    prisma.doctor.findUnique({ where: { id: doctorId } }),
  ]);
  const type  = catalog?.repasseType  ?? doctor?.repasseType;
  const value = catalog?.repasseValue ?? doctor?.repasseValue;
  if (!type || value == null) return 0;
  return type === "PERCENTAGE" ? (amount * value) / 100 : value;
}

const includeRelations = {
  catalog:       true,
  patient:       { select: { id: true, fullName: true, phone: true } },
  doctor:        { select: { id: true, user: { select: { name: true } }, specialty: true } },
  insurancePlan: { select: { id: true, name: true } },
  guia:          { select: { id: true, numeroGuia: true, status: true, numeroAutorizacao: true } },
  payment:       true,
} as const;

export async function examOrdersRoutes(app: FastifyInstance) {
  // ── Listar pedidos ────────────────────────────────────────────────────────
  app.get("/exam-orders", { preHandler: [requireAuth] }, async (req, reply) => {
    const { patientId, doctorId, status, from, to } = req.query as Record<string, string>;

    const orders = await prisma.examOrder.findMany({
      where: {
        ...(patientId && { patientId }),
        ...(doctorId  && { doctorId }),
        // Filtro de data para integração com Agenda
        ...(from || to ? {
          scheduledAt: {
            ...(from && { gte: new Date(from) }),
            ...(to   && { lte: new Date(to) }),
          },
        } : {}),
        // Filtro de status: se passou "auto", usa lógica por horário no frontend
        ...(status && status !== "auto" ? { status: status as any } : {}),
      },
      include: includeRelations,
      orderBy: { scheduledAt: "asc" },
    });

    // Aplica status automático por horário antes de retornar
    const enriched = orders.map(o => ({
      ...o,
      computedStatus: computeStatus(o),
    }));

    return reply.send(enriched);
  });

  // ── Criar pedido → gera Payment + DoctorPayment + Guia SP/SADT (se convênio) ─
  app.post("/exam-orders", { preHandler: [requireAuth] }, async (req, reply) => {
    const data = createSchema.parse(req.body);

    const catalog = await prisma.examCatalog.findUniqueOrThrow({ where: { id: data.catalogId } });
    const repasseAmount = await calcRepasse(data.catalogId, data.doctorId, catalog.price);

    const initialStatus = data.scheduledAt ? "SCHEDULED" : "PENDING";

    // Pré-carrega dados para auto-geração de Guia SP/SADT
    let patient: any = null;
    let doctor: any = null;
    let plan: any = null;
    let contract: any = null;
    if (data.insurancePlanId && catalog.tussCode) {
      [patient, doctor, plan] = await Promise.all([
        prisma.patient.findUnique({ where: { id: data.patientId } }),
        prisma.doctor.findUnique({ where: { id: data.doctorId }, include: { user: true } }),
        prisma.insurancePlan.findUnique({ where: { id: data.insurancePlanId } }),
      ]);
      if (plan) {
        contract = await prisma.insuranceContract.findFirst({
          where: {
            planId: plan.id,
            startDate: { lte: new Date() },
            OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
          },
          include: { procedures: true },
          orderBy: { startDate: "desc" },
        });
      }
    }

    const order = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          patientId:   data.patientId,
          amount:      catalog.price,
          description: `Exame/Procedimento: ${catalog.name}`,
          dueDate:     data.scheduledAt ? new Date(data.scheduledAt) : new Date(),
        },
      });

      const doctorPayment = repasseAmount > 0
        ? await tx.doctorPayment.create({
            data: {
              doctorId:  data.doctorId,
              paymentId: payment.id,
              amount:    repasseAmount,
              ...(data.appointmentId && { appointmentId: data.appointmentId }),
            },
          })
        : null;

      let guiaId: string | undefined;

      // Auto-geração de Guia SP/SADT
      if (data.insurancePlanId && catalog.tussCode && patient && doctor && plan) {
        const proc = contract?.procedures?.find((p: any) => p.tussCode === catalog.tussCode);
        const valor = proc?.price ?? catalog.price;

        const guiaCount = await tx.guiaFaturamento.count({ where: { insurancePlanId: data.insurancePlanId } });
        const numeroGuia = String(guiaCount + 1).padStart(6, "0");

        const guia = await tx.guiaFaturamento.create({
          data: {
            insurancePlanId:            data.insurancePlanId,
            tipo:                       "SP_SADT",
            numeroGuia,
            nomeBeneficiario:           patient.fullName,
            numeroCarteirinha:          patient.healthInsuranceNumber ?? "",
            valorApresentado:           valor,
            nomeExecutante:             doctor.user.name,
            crmExecutante:              doctor.crm,
            crmEstado:                  doctor.crmState,
            indicacaoAcidente:          9,
            codigoPrestadorNaOperadora: plan.codigoPrestadorNaOperadora ?? undefined,
            procedimentos: {
              create: [{
                tussCode:      catalog.tussCode,
                descricao:     catalog.name,
                quantidade:    1,
                valorUnitario: valor,
                valorTotal:    valor,
              }],
            },
          },
        });
        guiaId = guia.id;
      }

      return tx.examOrder.create({
        data: {
          patientId:       data.patientId,
          doctorId:        data.doctorId,
          catalogId:       data.catalogId,
          appointmentId:   data.appointmentId,
          insurancePlanId: data.insurancePlanId,
          guiaId,
          scheduledAt:     data.scheduledAt    ? new Date(data.scheduledAt)   : undefined,
          notes:           data.notes,
          status:          initialStatus as any,
          paymentId:       payment.id,
          doctorPaymentId: doctorPayment?.id,
        },
        include: includeRelations,
      });
    });

    return reply.status(201).send({
      ...order,
      computedStatus: computeStatus(order),
    });
  });

  // ── Criar pedidos em lote ──────────────────────────────────────────────────
  const batchSchema = z.object({
    patientId:       z.string(),
    doctorId:        z.string(),
    catalogIds:      z.array(z.string()).min(1).max(50),
    appointmentId:   z.string().optional(),
    insurancePlanId: z.string().optional(),
    scheduledAt:     z.string().datetime().optional(),
    notes:           z.string().optional(),
  });

  app.post("/exam-orders/batch", { preHandler: [requireAuth] }, async (req, reply) => {
    const data = batchSchema.parse(req.body);

    const catalogs = await prisma.examCatalog.findMany({
      where: { id: { in: data.catalogIds }, isActive: true },
    });
    if (catalogs.length !== data.catalogIds.length) {
      return reply.status(400).send({ error: "Um ou mais exames não encontrados ou inativos." });
    }

    const initialStatus = data.scheduledAt ? "SCHEDULED" : "PENDING";

    // Pré-carrega dados para auto-geração de Guia SP/SADT
    let patient: any = null;
    let doctor: any = null;
    let plan: any = null;
    let contract: any = null;
    if (data.insurancePlanId) {
      [patient, doctor, plan] = await Promise.all([
        prisma.patient.findUnique({ where: { id: data.patientId } }),
        prisma.doctor.findUnique({ where: { id: data.doctorId }, include: { user: true } }),
        prisma.insurancePlan.findUnique({ where: { id: data.insurancePlanId } }),
      ]);
      if (plan) {
        contract = await prisma.insuranceContract.findFirst({
          where: {
            planId: plan.id,
            startDate: { lte: new Date() },
            OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
          },
          include: { procedures: true },
          orderBy: { startDate: "desc" },
        });
      }
    }

    const orders = await prisma.$transaction(async (tx) => {
      const results = [];
      const orderIds: string[] = [];

      for (const catalog of catalogs) {
        const repasseAmount = await calcRepasse(catalog.id, data.doctorId, catalog.price);

        const payment = await tx.payment.create({
          data: {
            patientId:   data.patientId,
            amount:      catalog.price,
            description: `Exame/Procedimento: ${catalog.name}`,
            dueDate:     data.scheduledAt ? new Date(data.scheduledAt) : new Date(),
          },
        });

        const doctorPayment = repasseAmount > 0
          ? await tx.doctorPayment.create({
              data: {
                doctorId:  data.doctorId,
                paymentId: payment.id,
                amount:    repasseAmount,
                ...(data.appointmentId && { appointmentId: data.appointmentId }),
              },
            })
          : null;

        const order = await tx.examOrder.create({
          data: {
            patientId:       data.patientId,
            doctorId:        data.doctorId,
            catalogId:       catalog.id,
            appointmentId:   data.appointmentId,
            insurancePlanId: data.insurancePlanId,
            scheduledAt:     data.scheduledAt ? new Date(data.scheduledAt) : undefined,
            notes:           data.notes,
            status:          initialStatus as any,
            paymentId:       payment.id,
            doctorPaymentId: doctorPayment?.id,
          },
          include: includeRelations,
        });

        orderIds.push(order.id);
        results.push({ ...order, computedStatus: computeStatus(order) });
      }

      // Auto-geração de Guia SP/SADT para exames com convênio
      const catalogsComTuss = catalogs.filter(c => c.tussCode);
      if (data.insurancePlanId && patient && doctor && plan && catalogsComTuss.length > 0) {
        const procedimentosMap = contract?.procedures ?? [];
        const procedimentos = catalogsComTuss.map(c => {
          const proc = procedimentosMap.find((p: any) => p.tussCode === c.tussCode);
          const valor = proc?.price ?? c.price;
          return {
            tussCode:      c.tussCode!,
            descricao:     c.name,
            quantidade:    1,
            valorUnitario: valor,
            valorTotal:    valor,
          };
        });

        const valorTotal = procedimentos.reduce((sum, p) => sum + p.valorTotal, 0);
        const guiaCount = await tx.guiaFaturamento.count({ where: { insurancePlanId: data.insurancePlanId } });
        const numeroGuia = String(guiaCount + 1).padStart(6, "0");

        const guia = await tx.guiaFaturamento.create({
          data: {
            insurancePlanId: data.insurancePlanId,
            tipo:            "SP_SADT",
            numeroGuia,
            nomeBeneficiario:           patient.fullName,
            numeroCarteirinha:          patient.healthInsuranceNumber ?? "",
            valorApresentado:           valorTotal,
            nomeExecutante:             doctor.user.name,
            crmExecutante:              doctor.crm,
            crmEstado:                  doctor.crmState,
            indicacaoAcidente:          9,
            codigoPrestadorNaOperadora: plan.codigoPrestadorNaOperadora ?? undefined,
            procedimentos:              { create: procedimentos },
          },
        });

        // Vincula todos os ExamOrders à guia
        await tx.examOrder.updateMany({
          where: { id: { in: orderIds } },
          data:  { guiaId: guia.id },
        });

        // Re-carrega os orders com a guia vinculada
        for (let i = 0; i < results.length; i++) {
          results[i] = {
            ...(await tx.examOrder.findUniqueOrThrow({
              where: { id: results[i].id },
              include: includeRelations,
            })),
            computedStatus: computeStatus(results[i]),
          };
        }
      }

      return results;
    });

    return reply.status(201).send(orders);
  });

  // ── Atualizar status ───────────────────────────────────────────────────────
  app.patch("/exam-orders/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status, notes, scheduledAt, scheduledEnd } = req.body as any;

    const current = await prisma.examOrder.findUniqueOrThrow({
      where: { id },
      include: { payment: true },
    });

    // Regra: só conclui se o pagamento estiver pago
    if (status === "COMPLETED") {
      if (!current.payment || current.payment.status !== "PAID") {
        return reply.status(422).send({
          error: "Pagamento pendente. O exame/procedimento só pode ser concluído após validação do pagamento.",
          paymentStatus: current.payment?.status ?? "SEM_PAGAMENTO",
        });
      }
    }

    const update: any = {};
    if (status)      update.status      = status;
    if (notes)       update.notes       = notes;
    if (scheduledAt) update.scheduledAt = new Date(scheduledAt);
    if (status === "COMPLETED") update.completedAt = new Date();

    const order = await prisma.examOrder.update({
      where: { id },
      data: update,
      include: includeRelations,
    });

    return reply.send({ ...order, computedStatus: computeStatus(order) });
  });

  // ── Cancelar ───────────────────────────────────────────────────────────────
  app.delete("/exam-orders/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };

    const order = await prisma.examOrder.findUniqueOrThrow({ where: { id } });
    if (order.status === "COMPLETED") {
      return reply.status(422).send({ error: "Exame concluído não pode ser cancelado." });
    }

    await prisma.$transaction([
      prisma.examOrder.update({ where: { id }, data: { status: "CANCELLED" } }),
      // Cancela o pagamento vinculado se ainda pendente
      ...(order.paymentId ? [
        prisma.payment.updateMany({
          where: { id: order.paymentId, status: { in: ["PENDING", "OVERDUE"] } },
          data: { status: "CANCELLED" },
        }),
      ] : []),
    ]);

    return reply.status(204).send();
  });
}
