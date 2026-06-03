import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma2";
import { requireRole, getPayload } from "../plugins/auth"
const requireAuth = requireRole('ADMIN', 'RECEPTIONIST');

const materialSchema = z.object({
  name:         z.string().min(1),
  unit:         z.string().min(1),
  minStock:     z.number().nonnegative().optional(),
  currentStock: z.number().nonnegative().optional(),
  costPrice:    z.number().nonnegative().optional(),
  isActive:     z.boolean().optional(),
});

const movementSchema = z.object({
  materialId:    z.string(),
  type:          z.enum(["IN", "OUT"]),
  quantity:      z.number().positive(),
  reason:        z.string().optional(),
  appointmentId: z.string().optional(),
});

export async function stockRoutes(app: FastifyInstance) {
  // ── Materiais ─────────────────────────────────────────────────────────────
  app.get("/materials", { preHandler: [requireAuth] }, async (req, reply) => {
    const materials = await prisma.material.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return reply.send(materials);
  });

  app.post("/materials", { preHandler: [requireAuth] }, async (req, reply) => {
    const data = materialSchema.parse(req.body);
    const mat = await prisma.material.create({ data });
    return reply.status(201).send(mat);
  });

  app.patch("/materials/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = materialSchema.partial().parse(req.body);
    const mat = await prisma.material.update({ where: { id }, data });
    return reply.send(mat);
  });

  app.delete("/materials/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.material.update({ where: { id }, data: { isActive: false } });
    return reply.status(204).send();
  });

  // ── Movimentações ─────────────────────────────────────────────────────────
  app.get("/stock-movements", { preHandler: [requireAuth] }, async (req, reply) => {
    const { materialId } = req.query as { materialId?: string };
    const movements = await prisma.stockMovement.findMany({
      where: { ...(materialId && { materialId }) },
      include: { material: { select: { id: true, name: true, unit: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return reply.send(movements);
  });

  // Registrar entrada ou saída — atualiza saldo do material atomicamente
  app.post("/stock-movements", { preHandler: [requireAuth] }, async (req, reply) => {
    const body = movementSchema.parse(req.body);
    const user = getPayload(req);

    const result = await prisma.$transaction(async (tx) => {
      const material = await tx.material.findUniqueOrThrow({ where: { id: body.materialId } });

      const newStock =
        body.type === "IN"
          ? material.currentStock + body.quantity
          : material.currentStock - body.quantity;

      if (newStock < 0) throw new Error("Estoque insuficiente");

      await tx.material.update({
        where: { id: body.materialId },
        data: { currentStock: newStock },
      });

      return tx.stockMovement.create({
        data: { ...body, userId: user.sub },
        include: { material: { select: { id: true, name: true, unit: true, currentStock: true } } },
      });
    });

    return reply.status(201).send(result);
  });
}
