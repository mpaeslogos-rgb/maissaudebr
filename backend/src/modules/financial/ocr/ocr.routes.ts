import { FastifyInstance } from "fastify";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { extractBoletoFromPdf, saveBoletoAsAccountPayable } from "./ocr.service";

export async function ocrRoutes(app: FastifyInstance) {

  app.post(
    "/boleto",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const data = await request.file();
      
      if (!data) {
        return reply.code(400).send({ error: "Nenhum arquivo enviado" });
      }

      if (data.mimetype !== "application/pdf") {
        return reply.code(400).send({ error: "Apenas PDFs são aceitos" });
      }

      try {
        const buffer = await data.toBuffer();
        
        const fileName = `${crypto.randomUUID()}.pdf`;
        const uploadDir = path.join(process.cwd(), "uploads", "boletos");
        await fs.mkdir(uploadDir, { recursive: true });
        await fs.writeFile(path.join(uploadDir, fileName), buffer);
        
        const fileUrl = `/uploads/boletos/${fileName}`;

        const boletoData = await extractBoletoFromPdf(buffer);

        const category = (data.fields.category as any)?.value || "Outros";

        const accountPayable = await saveBoletoAsAccountPayable(
          boletoData,
          fileUrl,
          category
        );

        return reply.send({
          success: true,
          data: accountPayable,
          extracted: boletoData,
        });
      } catch (err: any) {
        app.log.error(err);
        return reply.code(500).send({
          error: "Falha ao processar boleto",
          message: err.message,
        });
      }
    }
  );

  app.get(
    "/boleto/:id",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { prisma } = await import("../../../server");
      
      const account = await prisma.accountPayable.findUnique({
        where: { id },
      });
      
      if (!account) return reply.code(404).send({ error: "Não encontrado" });
      return account;
    }
  );

  app.patch(
    "/boleto/:id/confirm",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const { prisma } = await import("../../../server");

      const updated = await prisma.accountPayable.update({
        where: { id },
        data: {
          ...body,
          ocrStatus: "SUCCESS",
        },
      });

      return updated;
    }
  );
}
