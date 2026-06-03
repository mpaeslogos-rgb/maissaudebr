-- Migration: SaaS — Convênios, Exames da Clínica, Estoque, isReturn no Appointment

-- ── Novos enums ────────────────────────────────────────────────────────────────
CREATE TYPE "ExamOrderStatus" AS ENUM ('PENDING', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT');

-- ── Convênios ─────────────────────────────────────────────────────────────────
CREATE TABLE "insurance_plans" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "ansCode"   TEXT,
    "phone"     TEXT,
    "email"     TEXT,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "insurance_plans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "insurance_plans_name_idx" ON "insurance_plans"("name");

CREATE TABLE "insurance_contracts" (
    "id"              TEXT NOT NULL,
    "planId"          TEXT NOT NULL,
    "startDate"       TIMESTAMP(3) NOT NULL,
    "endDate"         TIMESTAMP(3),
    "consultationFee" DOUBLE PRECISION,
    "notes"           TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "insurance_contracts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "insurance_contracts_planId_idx" ON "insurance_contracts"("planId");

ALTER TABLE "insurance_contracts"
    ADD CONSTRAINT "insurance_contracts_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "insurance_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "insurance_procedures" (
    "id"          TEXT NOT NULL,
    "contractId"  TEXT NOT NULL,
    "tussCode"    TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price"       DOUBLE PRECISION NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "insurance_procedures_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "insurance_procedures_contractId_idx" ON "insurance_procedures"("contractId");
CREATE INDEX "insurance_procedures_tussCode_idx" ON "insurance_procedures"("tussCode");

ALTER TABLE "insurance_procedures"
    ADD CONSTRAINT "insurance_procedures_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "insurance_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Campos novos no Appointment ───────────────────────────────────────────────
ALTER TABLE "appointments"
    ADD COLUMN "isReturn"        BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "insurancePlanId" TEXT;

ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_insurancePlanId_fkey"
    FOREIGN KEY ("insurancePlanId") REFERENCES "insurance_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Catálogo de Exames ────────────────────────────────────────────────────────
CREATE TABLE "exam_catalog" (
    "id"           TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "description"  TEXT,
    "price"        DOUBLE PRECISION NOT NULL,
    "duration"     INTEGER,
    "repasseType"  "RepasseType",
    "repasseValue" DOUBLE PRECISION,
    "isActive"     BOOLEAN NOT NULL DEFAULT true,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "exam_catalog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "exam_catalog_name_idx" ON "exam_catalog"("name");

-- ── Pedidos de Exame ──────────────────────────────────────────────────────────
CREATE TABLE "exam_orders" (
    "id"              TEXT NOT NULL,
    "patientId"       TEXT NOT NULL,
    "doctorId"        TEXT NOT NULL,
    "catalogId"       TEXT NOT NULL,
    "appointmentId"   TEXT,
    "scheduledAt"     TIMESTAMP(3),
    "completedAt"     TIMESTAMP(3),
    "status"          "ExamOrderStatus" NOT NULL DEFAULT 'PENDING',
    "notes"           TEXT,
    "paymentId"       TEXT,
    "doctorPaymentId" TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "exam_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "exam_orders_paymentId_key"       ON "exam_orders"("paymentId");
CREATE UNIQUE INDEX "exam_orders_doctorPaymentId_key" ON "exam_orders"("doctorPaymentId");
CREATE INDEX "exam_orders_patientId_idx" ON "exam_orders"("patientId");
CREATE INDEX "exam_orders_doctorId_idx"  ON "exam_orders"("doctorId");
CREATE INDEX "exam_orders_status_idx"    ON "exam_orders"("status");

ALTER TABLE "exam_orders"
    ADD CONSTRAINT "exam_orders_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "exam_orders"
    ADD CONSTRAINT "exam_orders_doctorId_fkey"
    FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "exam_orders"
    ADD CONSTRAINT "exam_orders_catalogId_fkey"
    FOREIGN KEY ("catalogId") REFERENCES "exam_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "exam_orders"
    ADD CONSTRAINT "exam_orders_appointmentId_fkey"
    FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "exam_orders"
    ADD CONSTRAINT "exam_orders_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "exam_orders"
    ADD CONSTRAINT "exam_orders_doctorPaymentId_fkey"
    FOREIGN KEY ("doctorPaymentId") REFERENCES "doctor_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Estoque ───────────────────────────────────────────────────────────────────
CREATE TABLE "materials" (
    "id"           TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "unit"         TEXT NOT NULL,
    "minStock"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costPrice"    DOUBLE PRECISION,
    "isActive"     BOOLEAN NOT NULL DEFAULT true,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "materials_name_idx" ON "materials"("name");

CREATE TABLE "stock_movements" (
    "id"            TEXT NOT NULL,
    "materialId"    TEXT NOT NULL,
    "type"          "StockMovementType" NOT NULL,
    "quantity"      DOUBLE PRECISION NOT NULL,
    "reason"        TEXT,
    "appointmentId" TEXT,
    "userId"        TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stock_movements_materialId_idx" ON "stock_movements"("materialId");
CREATE INDEX "stock_movements_type_idx"       ON "stock_movements"("type");

ALTER TABLE "stock_movements"
    ADD CONSTRAINT "stock_movements_materialId_fkey"
    FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_movements"
    ADD CONSTRAINT "stock_movements_appointmentId_fkey"
    FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_movements"
    ADD CONSTRAINT "stock_movements_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
