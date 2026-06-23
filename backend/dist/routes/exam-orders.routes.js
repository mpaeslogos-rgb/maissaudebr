"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.examOrdersRoutes = examOrdersRoutes;
const zod_1 = require("zod");
const prisma2_1 = require("../lib/prisma2");
const auth_1 = require("../plugins/auth");
const requireAuth = (0, auth_1.requireRole)('ADMIN', 'DOCTOR', 'RECEPTIONIST');
const createSchema = zod_1.z.object({
    patientId: zod_1.z.string(),
    doctorId: zod_1.z.string(),
    catalogId: zod_1.z.string(),
    appointmentId: zod_1.z.string().optional(),
    insurancePlanId: zod_1.z.string().optional(),
    scheduledAt: zod_1.z.string().datetime().optional(),
    scheduledEnd: zod_1.z.string().datetime().optional(),
    notes: zod_1.z.string().optional(),
});
// Regra de status automático por horário
function computeStatus(order) {
    if (order.status === "CANCELLED" || order.status === "COMPLETED")
        return order.status;
    if (!order.scheduledAt)
        return "PENDING";
    const now = new Date();
    if (order.scheduledAt > now)
        return "SCHEDULED";
    return "IN_PROGRESS";
}
async function calcRepasse(catalogId, doctorId, amount) {
    const [catalog, doctor] = await Promise.all([
        prisma2_1.prisma.examCatalog.findUnique({ where: { id: catalogId } }),
        prisma2_1.prisma.doctor.findUnique({ where: { id: doctorId } }),
    ]);
    const type = catalog?.repasseType ?? doctor?.repasseType;
    const value = catalog?.repasseValue ?? doctor?.repasseValue;
    if (!type || value == null)
        return 0;
    return type === "PERCENTAGE" ? (amount * value) / 100 : value;
}
const includeRelations = {
    catalog: true,
    patient: { select: { id: true, fullName: true, phone: true } },
    doctor: { select: { id: true, user: { select: { name: true } }, specialty: true } },
    insurancePlan: { select: { id: true, name: true } },
    guia: { select: { id: true, numeroGuia: true, status: true, numeroAutorizacao: true } },
    payment: true,
};
async function examOrdersRoutes(app) {
    // ── Listar pedidos ────────────────────────────────────────────────────────
    app.get("/exam-orders", { preHandler: [requireAuth] }, async (req, reply) => {
        const { patientId, doctorId, status, from, to } = req.query;
        const orders = await prisma2_1.prisma.examOrder.findMany({
            where: {
                ...(patientId && { patientId }),
                ...(doctorId && { doctorId }),
                // Filtro de data para integração com Agenda
                ...(from || to ? {
                    scheduledAt: {
                        ...(from && { gte: new Date(from) }),
                        ...(to && { lte: new Date(to) }),
                    },
                } : {}),
                // Filtro de status: se passou "auto", usa lógica por horário no frontend
                ...(status && status !== "auto" ? { status: status } : {}),
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
        const catalog = await prisma2_1.prisma.examCatalog.findUniqueOrThrow({ where: { id: data.catalogId } });
        const repasseAmount = await calcRepasse(data.catalogId, data.doctorId, catalog.price);
        const initialStatus = data.scheduledAt ? "SCHEDULED" : "PENDING";
        // Pré-carrega dados para auto-geração de Guia SP/SADT
        let patient = null;
        let doctor = null;
        let plan = null;
        let contract = null;
        if (data.insurancePlanId && catalog.tussCode) {
            [patient, doctor, plan] = await Promise.all([
                prisma2_1.prisma.patient.findUnique({ where: { id: data.patientId } }),
                prisma2_1.prisma.doctor.findUnique({ where: { id: data.doctorId }, include: { user: true } }),
                prisma2_1.prisma.insurancePlan.findUnique({ where: { id: data.insurancePlanId } }),
            ]);
            if (plan) {
                contract = await prisma2_1.prisma.insuranceContract.findFirst({
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
        const order = await prisma2_1.prisma.$transaction(async (tx) => {
            const payment = await tx.payment.create({
                data: {
                    patientId: data.patientId,
                    amount: catalog.price,
                    description: `Exame/Procedimento: ${catalog.name}`,
                    dueDate: data.scheduledAt ? new Date(data.scheduledAt) : new Date(),
                },
            });
            const doctorPayment = repasseAmount > 0
                ? await tx.doctorPayment.create({
                    data: {
                        doctorId: data.doctorId,
                        paymentId: payment.id,
                        amount: repasseAmount,
                        ...(data.appointmentId && { appointmentId: data.appointmentId }),
                    },
                })
                : null;
            let guiaId;
            // Auto-geração de Guia SP/SADT
            if (data.insurancePlanId && catalog.tussCode && patient && doctor && plan) {
                const proc = contract?.procedures?.find((p) => p.tussCode === catalog.tussCode);
                const valor = proc?.price ?? catalog.price;
                const guiaCount = await tx.guiaFaturamento.count({ where: { insurancePlanId: data.insurancePlanId } });
                const numeroGuia = String(guiaCount + 1).padStart(6, "0");
                const guia = await tx.guiaFaturamento.create({
                    data: {
                        insurancePlanId: data.insurancePlanId,
                        tipo: "SP_SADT",
                        numeroGuia,
                        nomeBeneficiario: patient.fullName,
                        numeroCarteirinha: patient.healthInsuranceNumber ?? "",
                        valorApresentado: valor,
                        nomeExecutante: doctor.user.name,
                        crmExecutante: doctor.crm,
                        crmEstado: doctor.crmState,
                        indicacaoAcidente: 9,
                        codigoPrestadorNaOperadora: plan.codigoPrestadorNaOperadora ?? undefined,
                        procedimentos: {
                            create: [{
                                    tussCode: catalog.tussCode,
                                    descricao: catalog.name,
                                    quantidade: 1,
                                    valorUnitario: valor,
                                    valorTotal: valor,
                                }],
                        },
                    },
                });
                guiaId = guia.id;
            }
            return tx.examOrder.create({
                data: {
                    patientId: data.patientId,
                    doctorId: data.doctorId,
                    catalogId: data.catalogId,
                    appointmentId: data.appointmentId,
                    insurancePlanId: data.insurancePlanId,
                    guiaId,
                    scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
                    notes: data.notes,
                    status: initialStatus,
                    paymentId: payment.id,
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
    const batchSchema = zod_1.z.object({
        patientId: zod_1.z.string(),
        doctorId: zod_1.z.string(),
        catalogIds: zod_1.z.array(zod_1.z.string()).min(1).max(50),
        appointmentId: zod_1.z.string().optional(),
        insurancePlanId: zod_1.z.string().optional(),
        scheduledAt: zod_1.z.string().datetime().optional(),
        notes: zod_1.z.string().optional(),
    });
    app.post("/exam-orders/batch", { preHandler: [requireAuth] }, async (req, reply) => {
        const data = batchSchema.parse(req.body);
        const catalogs = await prisma2_1.prisma.examCatalog.findMany({
            where: { id: { in: data.catalogIds }, isActive: true },
        });
        if (catalogs.length !== data.catalogIds.length) {
            return reply.status(400).send({ error: "Um ou mais exames não encontrados ou inativos." });
        }
        const initialStatus = data.scheduledAt ? "SCHEDULED" : "PENDING";
        // Pré-carrega dados para auto-geração de Guia SP/SADT
        let patient = null;
        let doctor = null;
        let plan = null;
        let contract = null;
        if (data.insurancePlanId) {
            [patient, doctor, plan] = await Promise.all([
                prisma2_1.prisma.patient.findUnique({ where: { id: data.patientId } }),
                prisma2_1.prisma.doctor.findUnique({ where: { id: data.doctorId }, include: { user: true } }),
                prisma2_1.prisma.insurancePlan.findUnique({ where: { id: data.insurancePlanId } }),
            ]);
            if (plan) {
                contract = await prisma2_1.prisma.insuranceContract.findFirst({
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
        const orders = await prisma2_1.prisma.$transaction(async (tx) => {
            const results = [];
            const orderIds = [];
            for (const catalog of catalogs) {
                const repasseAmount = await calcRepasse(catalog.id, data.doctorId, catalog.price);
                const payment = await tx.payment.create({
                    data: {
                        patientId: data.patientId,
                        amount: catalog.price,
                        description: `Exame/Procedimento: ${catalog.name}`,
                        dueDate: data.scheduledAt ? new Date(data.scheduledAt) : new Date(),
                    },
                });
                const doctorPayment = repasseAmount > 0
                    ? await tx.doctorPayment.create({
                        data: {
                            doctorId: data.doctorId,
                            paymentId: payment.id,
                            amount: repasseAmount,
                            ...(data.appointmentId && { appointmentId: data.appointmentId }),
                        },
                    })
                    : null;
                const order = await tx.examOrder.create({
                    data: {
                        patientId: data.patientId,
                        doctorId: data.doctorId,
                        catalogId: catalog.id,
                        appointmentId: data.appointmentId,
                        insurancePlanId: data.insurancePlanId,
                        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
                        notes: data.notes,
                        status: initialStatus,
                        paymentId: payment.id,
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
                    const proc = procedimentosMap.find((p) => p.tussCode === c.tussCode);
                    const valor = proc?.price ?? c.price;
                    return {
                        tussCode: c.tussCode,
                        descricao: c.name,
                        quantidade: 1,
                        valorUnitario: valor,
                        valorTotal: valor,
                    };
                });
                const valorTotal = procedimentos.reduce((sum, p) => sum + p.valorTotal, 0);
                const guiaCount = await tx.guiaFaturamento.count({ where: { insurancePlanId: data.insurancePlanId } });
                const numeroGuia = String(guiaCount + 1).padStart(6, "0");
                const guia = await tx.guiaFaturamento.create({
                    data: {
                        insurancePlanId: data.insurancePlanId,
                        tipo: "SP_SADT",
                        numeroGuia,
                        nomeBeneficiario: patient.fullName,
                        numeroCarteirinha: patient.healthInsuranceNumber ?? "",
                        valorApresentado: valorTotal,
                        nomeExecutante: doctor.user.name,
                        crmExecutante: doctor.crm,
                        crmEstado: doctor.crmState,
                        indicacaoAcidente: 9,
                        codigoPrestadorNaOperadora: plan.codigoPrestadorNaOperadora ?? undefined,
                        procedimentos: { create: procedimentos },
                    },
                });
                // Vincula todos os ExamOrders à guia
                await tx.examOrder.updateMany({
                    where: { id: { in: orderIds } },
                    data: { guiaId: guia.id },
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
        const { id } = req.params;
        const { status, notes, scheduledAt, scheduledEnd } = req.body;
        const current = await prisma2_1.prisma.examOrder.findUniqueOrThrow({
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
        const update = {};
        if (status)
            update.status = status;
        if (notes)
            update.notes = notes;
        if (scheduledAt)
            update.scheduledAt = new Date(scheduledAt);
        if (status === "COMPLETED")
            update.completedAt = new Date();
        const order = await prisma2_1.prisma.examOrder.update({
            where: { id },
            data: update,
            include: includeRelations,
        });
        return reply.send({ ...order, computedStatus: computeStatus(order) });
    });
    // ── Cancelar ───────────────────────────────────────────────────────────────
    app.delete("/exam-orders/:id", { preHandler: [requireAuth] }, async (req, reply) => {
        const { id } = req.params;
        const order = await prisma2_1.prisma.examOrder.findUniqueOrThrow({ where: { id } });
        if (order.status === "COMPLETED") {
            return reply.status(422).send({ error: "Exame concluído não pode ser cancelado." });
        }
        await prisma2_1.prisma.$transaction([
            prisma2_1.prisma.examOrder.update({ where: { id }, data: { status: "CANCELLED" } }),
            // Cancela o pagamento vinculado se ainda pendente
            ...(order.paymentId ? [
                prisma2_1.prisma.payment.updateMany({
                    where: { id: order.paymentId, status: { in: ["PENDING", "OVERDUE"] } },
                    data: { status: "CANCELLED" },
                }),
            ] : []),
        ]);
        return reply.status(204).send();
    });
}
