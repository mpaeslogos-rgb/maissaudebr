-- AlterTable: add vitals, structured history, lifestyle and specialty fields to medical_records
ALTER TABLE "medical_records"
  ADD COLUMN "bloodPressure"     TEXT,
  ADD COLUMN "heartRate"         INTEGER,
  ADD COLUMN "temperature"       DOUBLE PRECISION,
  ADD COLUMN "weight"            DOUBLE PRECISION,
  ADD COLUMN "height"            DOUBLE PRECISION,
  ADD COLUMN "oxygenSaturation"  DOUBLE PRECISION,
  ADD COLUMN "currentMedications" TEXT,
  ADD COLUMN "pastConditions"    TEXT,
  ADD COLUMN "pastSurgeries"     TEXT,
  ADD COLUMN "familyHistory"     TEXT,
  ADD COLUMN "smokingStatus"     TEXT,
  ADD COLUMN "alcoholStatus"     TEXT,
  ADD COLUMN "physicalActivity"  TEXT,
  ADD COLUMN "specialtyData"     JSONB;
