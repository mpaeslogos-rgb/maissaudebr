import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma2";
import { requireRole } from "../plugins/auth"
const requireAuth = requireRole('ADMIN', 'RECEPTIONIST');

const planSchema = z.object({
  name:     z.string().min(1),
  ansCode:  z.string().optional(),
  phone:    z.string().optional(),
  email:    z.string().email().optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

const contractSchema = z.object({
  planId:          z.string(),
  startDate:       z.string().datetime(),
  endDate:         z.string().datetime().optional(),
  consultationFee: z.number().nonnegative().optional(),
  notes:           z.string().optional(),
});

const procedureSchema = z.object({
  contractId:  z.string(),
  tussCode:    z.string().min(1),
  description: z.string().min(1),
  price:       z.number().nonnegative(),
});

export async function insurancePlansRoutes(app: FastifyInstance) {
  // ── Planos ───────────────────────────────────────────────────────────────
  app.get("/insurance-plans", { preHandler: [requireRole('ADMIN', 'RECEPTIONIST', 'DOCTOR')] }, async (req, reply) => {
    const plans = await prisma.insurancePlan.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: { contracts: { include: { procedures: true } } },
    });
    return reply.send(plans);
  });

  app.post("/insurance-plans", { preHandler: [requireAuth] }, async (req, reply) => {
    const data = planSchema.parse(req.body);
    const plan = await prisma.insurancePlan.create({ data });
    return reply.status(201).send(plan);
  });

  app.patch("/insurance-plans/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = planSchema.partial().parse(req.body);
    const plan = await prisma.insurancePlan.update({ where: { id }, data });
    return reply.send(plan);
  });

  app.delete("/insurance-plans/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.insurancePlan.update({ where: { id }, data: { isActive: false } });
    return reply.status(204).send();
  });

  // ── Contratos ─────────────────────────────────────────────────────────────
  app.post("/insurance-contracts", { preHandler: [requireAuth] }, async (req, reply) => {
    const data = contractSchema.parse(req.body);
    const contract = await prisma.insuranceContract.create({
      data: { ...data, startDate: new Date(data.startDate), endDate: data.endDate ? new Date(data.endDate) : undefined },
    });
    return reply.status(201).send(contract);
  });

  app.patch("/insurance-contracts/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = contractSchema.partial().omit({ planId: true }).parse(req.body);
    const contract = await prisma.insuranceContract.update({
      where: { id },
      data: {
        ...data,
        ...(data.startDate && { startDate: new Date(data.startDate) }),
        ...(data.endDate   && { endDate:   new Date(data.endDate) }),
      },
    });
    return reply.send(contract);
  });

  app.delete("/insurance-contracts/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.insuranceContract.delete({ where: { id } });
    return reply.status(204).send();
  });

  // ── Procedimentos ─────────────────────────────────────────────────────────
  app.post("/insurance-procedures", { preHandler: [requireAuth] }, async (req, reply) => {
    const data = procedureSchema.parse(req.body);
    const proc = await prisma.insuranceProcedure.create({ data });
    return reply.status(201).send(proc);
  });

  app.patch("/insurance-procedures/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = procedureSchema.partial().omit({ contractId: true }).parse(req.body);
    const proc = await prisma.insuranceProcedure.update({ where: { id }, data });
    return reply.send(proc);
  });

  app.delete("/insurance-procedures/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.insuranceProcedure.delete({ where: { id } });
    return reply.status(204).send();
  });
}
