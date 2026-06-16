import PDFDocument from "pdfkit";

export interface ClinicInfo {
  name: string;
  cnpj: string;
  cnes: string;
  address: string;
}

export interface DoctorInfo {
  name: string;
  crm: string;
  crmState: string;
  specialty: string;
  cpf?: string | null;
}

export interface PatientInfo {
  fullName: string;
  cpf?: string | null;
  birthDate?: Date | null;
}

export interface AtestadoData {
  clinic: ClinicInfo;
  doctor: DoctorInfo;
  patient: PatientInfo;
  dias: number;
  cid?: string | null;
  finalidade: string;
  observacoes?: string | null;
  dataAtestado: Date;
}

export interface ReceitaData {
  clinic: ClinicInfo;
  doctor: DoctorInfo;
  patient: PatientInfo;
  items: Array<{
    medication: string;
    dosage: string;
    frequency: string;
    duration?: string | null;
    instructions?: string | null;
  }>;
  notes?: string | null;
  emittedAt: Date;
  validUntil?: Date | null;
}

export interface LaudoData {
  clinic: ClinicInfo;
  doctor: DoctorInfo;
  patient: PatientInfo;
  examName: string;
  content: string;
  completedAt: Date;
}

function drawHeader(doc: InstanceType<typeof PDFDocument>, clinic: ClinicInfo) {
  doc.fontSize(16).font("Helvetica-Bold").text(clinic.name, { align: "center" });
  if (clinic.cnpj) doc.fontSize(9).font("Helvetica").text(`CNPJ: ${clinic.cnpj}`, { align: "center" });
  if (clinic.cnes) doc.fontSize(9).font("Helvetica").text(`CNES: ${clinic.cnes}`, { align: "center" });
  if (clinic.address) doc.fontSize(9).font("Helvetica").text(clinic.address, { align: "center" });
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1);
}

function drawDoctor(doc: InstanceType<typeof PDFDocument>, doctor: DoctorInfo) {
  doc
    .fontSize(10)
    .font("Helvetica")
    .text(`Dr(a). ${doctor.name}  —  CRM ${doctor.crm}/${doctor.crmState}  —  ${doctor.specialty}`);
  doc.moveDown(0.5);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export function generateAtestadoPdf(data: AtestadoData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 50, bottom: 50, left: 50, right: 50 } });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawHeader(doc, data.clinic);
    doc.fontSize(14).font("Helvetica-Bold").text("ATESTADO MÉDICO", { align: "center" });
    doc.moveDown(1.5);

    const finalidadeMap: Record<string, string> = {
      trabalho: "fins de trabalho/emprego",
      escola: "fins escolares",
      outro: "fins que se fizerem necessários",
    };

    doc.fontSize(11).font("Helvetica").text(
      `Atesto para ${finalidadeMap[data.finalidade] ?? data.finalidade} que ${data.patient.fullName}` +
        (data.patient.cpf ? `, CPF ${data.patient.cpf},` : ",") +
        ` esteve sob meus cuidados médicos e necessita de afastamento de suas atividades por ${data.dias} (${diasPorExtenso(data.dias)}) dia(s) a partir desta data.`,
      { lineGap: 4 }
    );

    if (data.cid) {
      doc.moveDown(0.5).text(`CID-10: ${data.cid}`);
    }

    if (data.observacoes) {
      doc.moveDown(0.5).text(`Observações: ${data.observacoes}`);
    }

    doc.moveDown(2);
    doc.text(formatDate(data.dataAtestado), { align: "center" });
    doc.moveDown(3);
    doc.moveTo(175, doc.y).lineTo(420, doc.y).stroke();
    doc.moveDown(0.3);
    drawDoctor(doc, data.doctor);

    doc.end();
  });
}

export function generateReceitaPdf(data: ReceitaData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 50, bottom: 50, left: 50, right: 50 } });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawHeader(doc, data.clinic);
    doc.fontSize(14).font("Helvetica-Bold").text("RECEITUÁRIO MÉDICO", { align: "center" });
    doc.moveDown(1);

    doc.fontSize(10).font("Helvetica").text(`Paciente: ${data.patient.fullName}`);
    if (data.patient.cpf) doc.text(`CPF: ${data.patient.cpf}`);
    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).dash(3, { space: 3 }).stroke().undash();
    doc.moveDown(1);

    data.items.forEach((item, i) => {
      doc.fontSize(11).font("Helvetica-Bold").text(`${i + 1}. ${item.medication}`);
      doc
        .fontSize(10)
        .font("Helvetica")
        .text(`   Dose: ${item.dosage}   |   Frequência: ${item.frequency}` + (item.duration ? `   |   Duração: ${item.duration}` : ""));
      if (item.instructions) doc.text(`   ${item.instructions}`);
      doc.moveDown(0.7);
    });

    if (data.notes) {
      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica-Oblique").text(`Obs: ${data.notes}`);
    }

    if (data.validUntil) {
      doc.moveDown(0.5).font("Helvetica").text(`Válido até: ${formatDate(data.validUntil)}`);
    }

    doc.moveDown(2);
    doc.text(formatDate(data.emittedAt), { align: "center" });
    doc.moveDown(3);
    doc.moveTo(175, doc.y).lineTo(420, doc.y).stroke();
    doc.moveDown(0.3);
    drawDoctor(doc, data.doctor);

    doc.end();
  });
}

export function generateLaudoPdf(data: LaudoData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 50, bottom: 50, left: 50, right: 50 } });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawHeader(doc, data.clinic);
    doc.fontSize(14).font("Helvetica-Bold").text("LAUDO MÉDICO", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(12).font("Helvetica").text(data.examName, { align: "center" });
    doc.moveDown(1);

    doc.fontSize(10).font("Helvetica").text(`Paciente: ${data.patient.fullName}`);
    if (data.patient.cpf) doc.text(`CPF: ${data.patient.cpf}`);
    doc.text(`Data: ${formatDate(data.completedAt)}`);
    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1);

    doc.fontSize(11).font("Helvetica").text(data.content, { lineGap: 4 });

    doc.moveDown(3);
    doc.moveTo(175, doc.y).lineTo(420, doc.y).stroke();
    doc.moveDown(0.3);
    drawDoctor(doc, data.doctor);

    doc.end();
  });
}

function diasPorExtenso(n: number): string {
  const unidades = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
    "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  if (n < 20) return unidades[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? dezenas[d] : `${dezenas[d]} e ${unidades[u]}`;
}
