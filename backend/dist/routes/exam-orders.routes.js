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
    // ── Criar pedido → gera Payment + DoctorPayment ───────────────────────────
    app.post("/exam-orders", { preHandler: [requireAuth] }, async (req, reply) => {
        const data = createSchema.parse(req.body);
        const catalog = await prisma2_1.prisma.examCatalog.findUniqueOrThrow({ where: { id: data.catalogId } });
        const repasseAmount = await calcRepasse(data.catalogId, data.doctorId, catalog.price);
        // Status inicial determinado pelo agendamento
        const initialStatus = data.scheduledAt ? "SCHEDULED" : "PENDING";
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
            return tx.examOrder.create({
                data: {
                    patientId: data.patientId,
                    doctorId: data.doctorId,
                    catalogId: data.catalogId,
                    appointmentId: data.appointmentId,
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
