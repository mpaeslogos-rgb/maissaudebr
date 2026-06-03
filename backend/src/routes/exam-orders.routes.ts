import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma2";
import { requireRole, getPayload } from "../plugins/auth"
const requireAuth = requireRole('ADMIN', 'DOCTOR', 'RECEPTIONIST');

const createSchema = z.object({
  patientId:     z.string(),
  doctorId:      z.string(),
  catalogId:     z.string(),
  appointmentId: z.string().optional(),
  scheduledAt:   z.string().datetime().optional(),
  notes:         z.string().optional(),
});

// Calcula valor do repasse: usa override do catálogo ou fallback para regra do médico
async function calcRepasse(catalogId: string, doctorId: string, amount: number): Promise<number> {
  const catalog = await prisma.examCatalog.findUnique({ where: { id: catalogId } });
  const doctor  = await prisma.doctor.findUnique({ where: { id: doctorId } });

  const type  = catalog?.repasseType  ?? doctor?.repasseType;
  const value = catalog?.repasseValue ?? doctor?.repasseValue;

  if (!type || value == null) return 0;
  if (type === "PERCENTAGE") return (amount * value) / 100;
  return value;
}

export async function examOrdersRoutes(app: FastifyInstance) {
  // Listar pedidos (com filtros opcionais)
  app.get("/exam-orders", { preHandler: [requireAuth] }, async (req, reply) => {
    const { patientId, doctorId, status } = req.query as Record<string, string>;
    const orders = await prisma.examOrder.findMany({
      where: {
        ...(patientId && { patientId }),
        ...(doctorId  && { doctorId }),
        ...(status    && { status: status as any }),
      },
      include: {
        catalog:     true,
        patient:     { select: { id: true, fullName: true } },
        doctor:      { select: { id: true, user: { select: { name: true } } } },
        payment:     true,
      },
      orderBy: { createdAt: "desc" },
    });
    return reply.send(orders);
  });

  // Criar pedido de exame → gera Payment e DoctorPayment automaticamente
  app.post("/exam-orders", { preHandler: [requireAuth] }, async (req, reply) => {
    const data = createSchema.parse(req.body);

    const catalog = await prisma.examCatalog.findUniqueOrThrow({ where: { id: data.catalogId } });
    const repasseAmount = await calcRepasse(data.catalogId, data.doctorId, catalog.price);

    const order = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          patientId:   data.patientId,
          amount:      catalog.price,
          description: `Exame: ${catalog.name}`,
          dueDate:     data.scheduledAt ? new Date(data.scheduledAt) : new Date(),
        },
      });

      const doctorPayment = repasseAmount > 0
        ? await tx.doctorPayment.create({
            data: {
              doctorId:      data.doctorId,
              appointmentId: data.appointmentId ?? undefined,
              paymentId:     payment.id,
              amount:        repasseAmount,
            },
          })
        : null;

      return tx.examOrder.create({
        data: {
          ...data,
          scheduledAt:    data.scheduledAt ? new Date(data.scheduledAt) : undefined,
          paymentId:      payment.id,
          doctorPaymentId: doctorPayment?.id,
        },
        include: { catalog: true, payment: true },
      });
    });

    return reply.status(201).send(order);
  });

  // Atualizar status
  app.patch("/exam-orders/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status, notes, completedAt } = req.body as any;
    const order = await prisma.examOrder.update({
      where: { id },
      data: {
        ...(status      && { status }),
        ...(notes       && { notes }),
        ...(completedAt && { completedAt: new Date(completedAt) }),
      },
      include: { catalog: true, payment: true },
    });
    return reply.send(order);
  });

  // Cancelar
  app.delete("/exam-orders/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.examOrder.update({ where: { id }, data: { status: "CANCELLED" } });
    return reply.status(204).send();
  });
}
