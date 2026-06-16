-- CreateEnum
CREATE TYPE "SignatureProvider" AS ENUM ('MOCK', 'VIDAAS', 'BIRDID');

-- CreateEnum
CREATE TYPE "SignatureStatus" AS ENUM ('PENDING', 'SIGNED', 'FAILED');

-- CreateEnum
CREATE TYPE "SignedDocumentType" AS ENUM ('ATESTADO', 'RECEITA', 'LAUDO');

-- AlterTable
ALTER TABLE "prescriptions" ADD COLUMN "signatureId" TEXT;

-- AlterTable
ALTER TABLE "exam_orders" ADD COLUMN "laudoContent" TEXT,
ADD COLUMN "signatureId" TEXT;

-- CreateTable
CREATE TABLE "digital_signatures" (
    "id" TEXT NOT NULL,
    "documentType" "SignedDocumentType" NOT NULL,
    "provider" "SignatureProvider" NOT NULL DEFAULT 'MOCK',
    "status" "SignatureStatus" NOT NULL DEFAULT 'PENDING',
    "doctorId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "oauthState" TEXT,
    "pdfPath" TEXT,
    "signedPdfPath" TEXT,
    "documentHash" TEXT,
    "signerName" TEXT,
    "signerCpf" TEXT,
    "signedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "digital_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atestados" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "dias" INTEGER NOT NULL,
    "cid" TEXT,
    "finalidade" TEXT NOT NULL,
    "observacoes" TEXT,
    "dataAtestado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signatureId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atestados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prescriptions_signatureId_key" ON "prescriptions"("signatureId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_orders_signatureId_key" ON "exam_orders"("signatureId");

-- CreateIndex
CREATE UNIQUE INDEX "digital_signatures_oauthState_key" ON "digital_signatures"("oauthState");

-- CreateIndex
CREATE INDEX "digital_signatures_status_idx" ON "digital_signatures"("status");

-- CreateIndex
CREATE INDEX "digital_signatures_doctorId_idx" ON "digital_signatures"("doctorId");

-- CreateIndex
CREATE INDEX "digital_signatures_referenceId_idx" ON "digital_signatures"("referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "atestados_signatureId_key" ON "atestados"("signatureId");

-- CreateIndex
CREATE INDEX "atestados_patientId_idx" ON "atestados"("patientId");

-- CreateIndex
CREATE INDEX "atestados_doctorId_idx" ON "atestados"("doctorId");

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_signatureId_fkey" FOREIGN KEY ("signatureId") REFERENCES "digital_signatures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_orders" ADD CONSTRAINT "exam_orders_signatureId_fkey" FOREIGN KEY ("signatureId") REFERENCES "digital_signatures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_signatures" ADD CONSTRAINT "digital_signatures_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_signatures" ADD CONSTRAINT "digital_signatures_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atestados" ADD CONSTRAINT "atestados_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atestados" ADD CONSTRAINT "atestados_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atestados" ADD CONSTRAINT "atestados_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atestados" ADD CONSTRAINT "atestados_signatureId_fkey" FOREIGN KEY ("signatureId") REFERENCES "digital_signatures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
