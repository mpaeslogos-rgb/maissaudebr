import OpenAI from "openai";
import pdfParse from "pdf-parse";
import { fromBuffer } from "pdf2pic";
import { parseDigitableLine } from "./boleto.validator";
import { prisma } from "../../../lib/prisma"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface BoletoData {
  supplier: string;
  supplierCnpj?: string;
  amount: number;
  dueDate: string;
  digitableLine: string;
  barcode?: string;
  bankCode?: string;
  description?: string;
  confidence: number;
  rawText: string;
}

export async function extractBoletoFromPdf(
  pdfBuffer: Buffer
): Promise<BoletoData> {
  const textResult = await tryExtractFromText(pdfBuffer);
  if (textResult && textResult.confidence > 0.85) {
    return textResult;
  }

  const visionResult = await tryExtractWithVision(pdfBuffer);
  if (visionResult) {
    return visionResult;
  }

  throw new Error("Não foi possível extrair dados do boleto");
}

async function tryExtractFromText(buffer: Buffer): Promise<BoletoData | null> {
  try {
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text;

    if (text.length < 50) return null;

    const digitableLineMatch = text.match(
      /(\d{5}[\s.]?\d{5}\s?\d{5}[\s.]?\d{6}\s?\d{5}[\s.]?\d{6}\s?\d{1}\s?\d{14})/
    );
    
    if (!digitableLineMatch) return null;

    const digitableLine = digitableLineMatch[0].replace(/\D/g, "");
    const parsed = parseDigitableLine(digitableLine);

    if (!parsed) return null;

    const structured = await structureWithGpt(text, parsed);

    return {
      ...structured,
      digitableLine,
      barcode: parsed.barcode,
      bankCode: parsed.bankCode,
      amount: parsed.amount,
      dueDate: parsed.dueDate,
      rawText: text,
      confidence: 0.95,
    };
  } catch (err) {
    console.error("[OCR] Falha na estratégia de texto:", err);
    return null;
  }
}

async function tryExtractWithVision(buffer: Buffer): Promise<BoletoData | null> {
  try {
    const converter = fromBuffer(buffer, {
      density: 200,
      format: "png",
      width: 1200,
      height: 1600,
    });
    const page = await converter(1, { responseType: "base64" });
    const base64Image = page.base64;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Você é um especialista em extrair dados de boletos bancários brasileiros.
Retorne APENAS um JSON válido com os campos:
{
  "supplier": "nome do beneficiário",
  "supplierCnpj": "CNPJ apenas números ou null",
  "amount": número decimal,
  "dueDate": "YYYY-MM-DD",
  "digitableLine": "47 dígitos sem formatação",
  "description": "descrição/histórico do boleto",
  "bankCode": "3 dígitos do banco emissor",
  "confidence": número de 0 a 1
}
Se não conseguir ler algum campo, use null. Não invente dados.`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extraia os dados deste boleto:" },
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${base64Image}` },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const data = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      supplier: data.supplier || "Desconhecido",
      supplierCnpj: data.supplierCnpj,
      amount: parseFloat(data.amount),
      dueDate: data.dueDate,
      digitableLine: data.digitableLine?.replace(/\D/g, "") || "",
      bankCode: data.bankCode,
      description: data.description,
      confidence: data.confidence || 0.7,
      rawText: "Extraído via Vision API",
    };
  } catch (err) {
    console.error("[OCR] Falha na estratégia Vision:", err);
    return null;
  }
}

async function structureWithGpt(
  rawText: string,
  parsed: ReturnType<typeof parseDigitableLine>
) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Extraia do texto de um boleto: supplier (beneficiário), supplierCnpj, description.
Retorne JSON: {"supplier": string, "supplierCnpj": string|null, "description": string}`,
      },
      { role: "user", content: rawText.substring(0, 3000) },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
  });

  return JSON.parse(response.choices[0].message.content || "{}");
}

export async function saveBoletoAsAccountPayable(
  data: BoletoData,
  fileUrl: string,
  category: string = "Outros"
) {
  const needsReview = data.confidence < 0.85;

  return prisma.accountPayable.create({
    data: {
      description: data.description || `Boleto ${data.supplier}`,
      supplier: data.supplier,
      supplierCnpj: data.supplierCnpj,
      amount: data.amount,
      dueDate: new Date(data.dueDate),
      category,
      digitableLine: data.digitableLine,
      barcode: data.barcode,
      bankCode: data.bankCode,
      fileUrl,
      ocrRawText: data.rawText,
      ocrConfidence: data.confidence,
      ocrStatus: needsReview ? "MANUAL_REVIEW" : "SUCCESS",
      status: "PENDING",
    },
  });
}
