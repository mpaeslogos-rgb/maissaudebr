-- Enum: tipo de repasse ao médico
CREATE TYPE "RepasseType" AS ENUM ('PERCENTAGE', 'FIXED');

-- Enum: status do repasse
CREATE TYPE "DoctorPaymentStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- Campos de repasse no Doctor
ALTER TABLE "doctors"
  ADD COLUMN "repasseType"  "RepasseType" NOT NULL DEFAULT 'PERCENTAGE',
  ADD COLUMN "repasseValue" DOUBLE PRECISION;

-- Tabela de repasses aos médicos
CREATE TABLE "doctor_payments" (
  "id"            TEXT NOT NULL,
  "doctorId"      TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "paymentId"     TEXT,
  "amount"        DOUBLE PRECISION NOT NULL,
  "status"        "DoctorPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "paidAt"        TIMESTAMP(3),
  "notes"         TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "doctor_payments_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
ALTER TABLE "doctor_payments" ADD CONSTRAINT "doctor_payments_appointmentId_key" UNIQUE ("appointmentId");
ALTER TABLE "doctor_payments" ADD CONSTRAINT "doctor_payments_paymentId_key"     UNIQUE ("paymentId");

-- Índices
CREATE INDEX "doctor_payments_doctorId_idx"      ON "doctor_payments"("doctorId");
CREATE INDEX "doctor_payments_status_idx"         ON "doctor_payments"("status");
CREATE INDEX "doctor_payments_appointmentId_idx"  ON "doctor_payments"("appointmentId");

-- Foreign keys
ALTER TABLE "doctor_payments"
  ADD CONSTRAINT "doctor_payments_doctorId_fkey"
    FOREIGN KEY ("doctorId")      REFERENCES "doctors"("id")      ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "doctor_payments_appointmentId_fkey"
    FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "doctor_payments_paymentId_fkey"
    FOREIGN KEY ("paymentId")     REFERENCES "payments"("id")     ON DELETE SET NULL ON UPDATE CASCADE;
