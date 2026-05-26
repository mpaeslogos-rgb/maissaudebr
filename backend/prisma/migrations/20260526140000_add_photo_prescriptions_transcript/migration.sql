-- AlterTable: photoUrl em patients
ALTER TABLE "patients" ADD COLUMN "photoUrl" TEXT;

-- AlterTable: transcript em medical_records
ALTER TABLE "medical_records" ADD COLUMN "transcript" TEXT;

-- CreateTable: prescriptions
CREATE TABLE "prescriptions" (
    "id"            TEXT NOT NULL,
    "patientId"     TEXT NOT NULL,
    "doctorId"      TEXT NOT NULL,
    "appointmentId" TEXT,
    "emittedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil"    TIMESTAMP(3),
    "notes"         TEXT,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: prescription_items
CREATE TABLE "prescription_items" (
    "id"             TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "medication"     TEXT NOT NULL,
    "dosage"         TEXT NOT NULL,
    "frequency"      TEXT NOT NULL,
    "duration"       TEXT,
    "instructions"   TEXT,
    "order"          INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "prescription_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prescriptions_appointmentId_key" ON "prescriptions"("appointmentId");
CREATE INDEX "prescriptions_patientId_idx" ON "prescriptions"("patientId");
CREATE INDEX "prescriptions_doctorId_idx" ON "prescriptions"("doctorId");
CREATE INDEX "prescription_items_prescriptionId_idx" ON "prescription_items"("prescriptionId");

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_doctorId_fkey"
    FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_appointmentId_fkey"
    FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescriptionId_fkey"
    FOREIGN KEY ("prescriptionId") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
