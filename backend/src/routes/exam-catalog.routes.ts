import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma2";
import { requireRole } from "../plugins/auth"
const requireAuth = requireRole('ADMIN', 'DOCTOR', 'RECEPTIONIST');

const catalogSchema = z.object({
  name:         z.string().min(1),
  description:  z.string().optional(),
  price:        z.number().positive(),
  duration:     z.number().int().positive().optional(),
  repasseType:  z.enum(["PERCENTAGE", "FIXED"]).optional(),
  repasseValue: z.number().nonnegative().optional(),
  isActive:     z.boolean().optional(),
});

export async function examCatalogRoutes(app: FastifyInstance) {
  // Listar
  app.get("/exam-catalog", { preHandler: [requireAuth] }, async (req, reply) => {
    const items = await prisma.examCatalog.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return reply.send(items);
  });

  // Criar
  app.post("/exam-catalog", { preHandler: [requireAuth] }, async (req, reply) => {
    const data = catalogSchema.parse(req.body);
    const item = await prisma.examCatalog.create({ data });
    return reply.status(201).send(item);
  });

  // Atualizar
  app.patch("/exam-catalog/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = catalogSchema.partial().parse(req.body);
    const item = await prisma.examCatalog.update({ where: { id }, data });
    return reply.send(item);
  });

  // Deletar (soft: isActive = false)
  app.delete("/exam-catalog/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.examCatalog.update({ where: { id }, data: { isActive: false } });
    return reply.status(204).send();
  });
}
