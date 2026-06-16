/*
  Warnings:

  - You are about to alter the column `amount` on the `accounts_payable` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `DoublePrecision`.
  - You are about to alter the column `consultationFee` on the `doctors` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `DoublePrecision`.
  - You are about to alter the column `amount` on the `payments` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `DoublePrecision`.

*/
-- CreateEnum
CREATE TYPE "RiskProfile" AS ENUM ('NONE', 'METABOLIC', 'CARDIOMETABOLIC', 'HIGH');

-- CreateEnum
CREATE TYPE "JourneyStage" AS ENUM ('ONBOARDING', 'ACTIVE', 'AT_RISK', 'COMPLETED', 'CHURNED');

-- CreateEnum
CREATE TYPE "CheckInType" AS ENUM ('INITIAL_ASSESSMENT', 'MONTHLY_REVIEW', 'METABOLIC_REVIEW', 'LAB_RESULTS', 'FOLLOWUP');

-- DropForeignKey
ALTER TABLE "doctor_payments" DROP CONSTRAINT "doctor_payments_appointmentId_fkey";

-- DropIndex
DROP INDEX "patients_deletedAt_idx";

-- AlterTable
ALTER TABLE "accounts_payable" ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "doctor_payments" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "doctors" ALTER COLUMN "consultationFee" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "leads" ALTER COLUMN "status" SET DEFAULT 'NOVO';

-- AlterTable
ALTER TABLE "nps_responses" ADD COLUMN     "enrollmentId" TEXT;

-- AlterTable
ALTER TABLE "patient_enrollments" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "journeyStage" "JourneyStage" NOT NULL DEFAULT 'ONBOARDING';

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "riskProfile" "RiskProfile" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "check_ins" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "type" "CheckInType" NOT NULL DEFAULT 'MONTHLY_REVIEW',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "check_ins_patientId_idx" ON "check_ins"("patientId");

-- CreateIndex
CREATE INDEX "check_ins_enrollmentId_idx" ON "check_ins"("enrollmentId");

-- CreateIndex
CREATE INDEX "check_ins_scheduledAt_idx" ON "check_ins"("scheduledAt");

-- CreateIndex
CREATE INDEX "nps_responses_enrollmentId_idx" ON "nps_responses"("enrollmentId");

-- CreateIndex
CREATE INDEX "patient_enrollments_journeyStage_idx" ON "patient_enrollments"("journeyStage");

-- AddForeignKey
ALTER TABLE "doctor_payments" ADD CONSTRAINT "doctor_payments_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nps_responses" ADD CONSTRAINT "nps_responses_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "patient_enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "patient_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
