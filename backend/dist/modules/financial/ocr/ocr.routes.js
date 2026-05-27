"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ocrRoutes = ocrRoutes;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const ocr_service_1 = require("./ocr.service");
const prisma_1 = require("../../../lib/prisma");
async function ocrRoutes(app) {
    app.post("/boleto", { preHandler: [app.authenticate] }, async (request, reply) => {
        const data = await request.file();
        if (!data) {
            return reply.code(400).send({ error: "Nenhum arquivo enviado" });
        }
        if (data.mimetype !== "application/pdf") {
            return reply.code(400).send({ error: "Apenas PDFs são aceitos" });
        }
        try {
            const buffer = await data.toBuffer();
            const fileName = `${crypto_1.default.randomUUID()}.pdf`;
            const uploadDir = path_1.default.join(process.cwd(), "uploads", "boletos");
            await promises_1.default.mkdir(uploadDir, { recursive: true });
            await promises_1.default.writeFile(path_1.default.join(uploadDir, fileName), buffer);
            const fileUrl = `/uploads/boletos/${fileName}`;
            const boletoData = await (0, ocr_service_1.extractBoletoFromPdf)(buffer);
            const category = data.fields.category?.value || "Outros";
            const accountPayable = await (0, ocr_service_1.saveBoletoAsAccountPayable)(boletoData, fileUrl, category);
            return reply.send({
                success: true,
                data: accountPayable,
                extracted: boletoData,
            });
        }
        catch (err) {
            app.log.error(err);
            return reply.code(500).send({
                error: "Falha ao processar boleto",
                message: err.message,
            });
        }
    });
    app.get("/boleto/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
        const { id } = request.params;
        const account = await prisma_1.prisma.accountPayable.findUnique({
            where: { id },
        });
        if (!account)
            return reply.code(404).send({ error: "Não encontrado" });
        return account;
    });
    app.patch("/boleto/:id/confirm", { preHandler: [app.authenticate] }, async (request, reply) => {
        const { id } = request.params;
        const body = request.body;
        const updated = await prisma_1.prisma.accountPayable.update({
            where: { id },
            data: {
                ...body,
                ocrStatus: "SUCCESS",
            },
        });
        return updated;
    });
}
