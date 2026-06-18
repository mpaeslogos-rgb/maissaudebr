import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma2";
import { requireRole, getPayload } from "../plugins/auth";

const includeItems = {
  items: { include: { catalog: true } },
} as const;

export async function examPackagesRoutes(app: FastifyInstance) {
  const auth = requireRole("ADMIN", "DOCTOR");

  app.get("/exam-packages", { preHandler: [auth] }, async (req, reply) => {
    const payload = getPayload(req);
    const doctor = payload.role === "DOCTOR"
      ? await prisma.doctor.findUnique({ where: { userId: payload.sub } })
      : null;

    const packages = await prisma.examPackage.findMany({
      where: {
        OR: [
          { doctorId: null },
          ...(doctor ? [{ doctorId: doctor.id }] : []),
          ...(payload.role === "ADMIN" ? [{}] : []),
        ],
      },
      include: includeItems,
      orderBy: { name: "asc" },
    });

    return reply.send(packages);
  });

  const createSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    catalogIds: z.array(z.string()).min(1).max(100),
    global: z.boolean().optional(),
  });

  app.post("/exam-packages", { preHandler: [auth] }, async (req, reply) => {
    const data = createSchema.parse(req.body);
    const payload = getPayload(req);

    let doctorId: string | null = null;
    if (data.global) {
      if (payload.role !== "ADMIN") {
        return reply.status(403).send({ error: "Apenas ADMIN pode criar pacotes globais." });
      }
    } else {
      const doctor = await prisma.doctor.findUnique({ where: { userId: payload.sub } });
      if (!doctor) return reply.status(400).send({ error: "Médico não encontrado." });
      doctorId = doctor.id;
    }

    const pkg = await prisma.examPackage.create({
      data: {
        name: data.name,
        description: data.description,
        doctorId,
        items: {
          create: data.catalogIds.map((catalogId) => ({ catalogId })),
        },
      },
      include: includeItems,
    });

    return reply.status(201).send(pkg);
  });

  const updateSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    catalogIds: z.array(z.string()).min(1).max(100).optional(),
  });

  app.patch("/exam-packages/:id", { preHandler: [auth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = updateSchema.parse(req.body);
    const payload = getPayload(req);

    const existing = await prisma.examPackage.findUniqueOrThrow({ where: { id } });
    if (payload.role !== "ADMIN" && existing.doctorId) {
      const doctor = await prisma.doctor.findUnique({ where: { userId: payload.sub } });
      if (existing.doctorId !== doctor?.id) {
        return reply.status(403).send({ error: "Sem permissão." });
      }
    }

    const pkg = await prisma.$transaction(async (tx) => {
      if (data.catalogIds) {
        await tx.examPackageItem.deleteMany({ where: { packageId: id } });
        await tx.examPackageItem.createMany({
          data: data.catalogIds.map((catalogId) => ({ packageId: id, catalogId })),
        });
      }
      return tx.examPackage.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
        },
        include: includeItems,
      });
    });

    return reply.send(pkg);
  });

  app.delete("/exam-packages/:id", { preHandler: [auth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = getPayload(req);

    const existing = await prisma.examPackage.findUniqueOrThrow({ where: { id } });
    if (payload.role !== "ADMIN" && existing.doctorId) {
      const doctor = await prisma.doctor.findUnique({ where: { userId: payload.sub } });
      if (existing.doctorId !== doctor?.id) {
        return reply.status(403).send({ error: "Sem permissão." });
      }
    }

    await prisma.examPackage.delete({ where: { id } });
    return reply.status(204).send();
  });
}
