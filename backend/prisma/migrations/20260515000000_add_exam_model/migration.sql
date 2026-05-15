-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('LABORATORY', 'IMAGING', 'REPORT', 'OTHER');

-- CreateTable
CREATE TABLE "exams" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "medicalRecordId" TEXT,
    "name" TEXT NOT NULL,
    "type" "ExamType" NOT NULL DEFAULT 'OTHER',
    "fileUrl" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "ocrText" TEXT,
    "notes" TEXT,
    "examDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exams_patientId_idx" ON "exams"("patientId");

-- CreateIndex
CREATE INDEX "exams_medicalRecordId_idx" ON "exams"("medicalRecordId");

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "medical_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
