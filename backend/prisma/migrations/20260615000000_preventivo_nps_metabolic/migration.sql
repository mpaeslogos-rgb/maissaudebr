-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED');

-- CreateTable
CREATE TABLE "preventivo_programs" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "durationDays" INTEGER NOT NULL,
    "monthlyFee"  DOUBLE PRECISION NOT NULL,
    "entryFee"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clinicScope" TEXT,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "preventivo_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_enrollments" (
    "id"              TEXT NOT NULL,
    "patientId"       TEXT NOT NULL,
    "programId"       TEXT NOT NULL,
    "startDate"       TIMESTAMP(3) NOT NULL,
    "endDate"         TIMESTAMP(3),
    "status"          "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "monthlyFee"      DOUBLE PRECISION NOT NULL,
    "nextBillingDate" TIMESTAMP(3) NOT NULL,
    "notes"           TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metabolic_markers" (
    "id"            TEXT NOT NULL,
    "patientId"     TEXT NOT NULL,
    "date"          TIMESTAMP(3) NOT NULL,
    "weight"        DOUBLE PRECISION,
    "bmi"           DOUBLE PRECISION,
    "systolicBP"    DOUBLE PRECISION,
    "diastolicBP"   DOUBLE PRECISION,
    "glucose"       DOUBLE PRECISION,
    "hba1c"         DOUBLE PRECISION,
    "totalChol"     DOUBLE PRECISION,
    "ldl"           DOUBLE PRECISION,
    "hdl"           DOUBLE PRECISION,
    "triglycerides" DOUBLE PRECISION,
    "notes"         TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metabolic_markers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nps_responses" (
    "id"            TEXT NOT NULL,
    "patientId"     TEXT NOT NULL,
    "appointmentId" TEXT,
    "score"         INTEGER NOT NULL,
    "comment"       TEXT,
    "sentAt"        TIMESTAMP(3),
    "respondedAt"   TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nps_responses_pkey" PRIMARY KEY ("id")
);

-- AddColumn payments.enrollmentId
ALTER TABLE "payments" ADD COLUMN "enrollmentId" TEXT;

-- CreateIndex
CREATE INDEX "preventivo_programs_isActive_idx" ON "preventivo_programs"("isActive");
CREATE INDEX "patient_enrollments_patientId_idx" ON "patient_enrollments"("patientId");
CREATE INDEX "patient_enrollments_status_idx" ON "patient_enrollments"("status");
CREATE INDEX "patient_enrollments_nextBillingDate_idx" ON "patient_enrollments"("nextBillingDate");
CREATE INDEX "metabolic_markers_patientId_idx" ON "metabolic_markers"("patientId");
CREATE INDEX "metabolic_markers_date_idx" ON "metabolic_markers"("date");
CREATE UNIQUE INDEX "nps_responses_appointmentId_key" ON "nps_responses"("appointmentId");
CREATE INDEX "nps_responses_patientId_idx" ON "nps_responses"("patientId");
CREATE INDEX "nps_responses_score_idx" ON "nps_responses"("score");

-- AddForeignKey
ALTER TABLE "patient_enrollments" ADD CONSTRAINT "patient_enrollments_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "patient_enrollments" ADD CONSTRAINT "patient_enrollments_programId_fkey"
    FOREIGN KEY ("programId") REFERENCES "preventivo_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "metabolic_markers" ADD CONSTRAINT "metabolic_markers_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "nps_responses" ADD CONSTRAINT "nps_responses_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "nps_responses" ADD CONSTRAINT "nps_responses_appointmentId_fkey"
    FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payments" ADD CONSTRAINT "payments_enrollmentId_fkey"
    FOREIGN KEY ("enrollmentId") REFERENCES "patient_enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
