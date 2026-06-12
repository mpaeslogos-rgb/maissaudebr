-- Migration: TISS Faturamento
-- Adiciona campo codigoPrestadorNaOperadora em insurance_plans
-- Cria tabelas lotes_faturamento, guias_faturamento, guia_procedimentos

-- Enums
CREATE TYPE "GuiaTipo" AS ENUM ('CONSULTA', 'SP_SADT');
CREATE TYPE "GuiaStatus" AS ENUM ('PENDENTE', 'AUTORIZADA', 'NEGADA', 'FATURADA', 'PAGA', 'GLOSADA');
CREATE TYPE "LoteStatus" AS ENUM ('ABERTO', 'FECHADO', 'ENVIADO', 'LIQUIDADO');

-- Campo novo em insurance_plans
ALTER TABLE "insurance_plans" ADD COLUMN "codigoPrestadorNaOperadora" TEXT;

-- Lotes de faturamento
CREATE TABLE "lotes_faturamento" (
    "id"              TEXT NOT NULL,
    "insurancePlanId" TEXT NOT NULL,
    "numeroLote"      INTEGER NOT NULL,
    "competencia"     TEXT NOT NULL,
    "status"          "LoteStatus" NOT NULL DEFAULT 'ABERTO',
    "valorTotal"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dataEnvio"       TIMESTAMP(3),
    "observacoes"     TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lotes_faturamento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lotes_faturamento_insurancePlanId_numeroLote_key"
    ON "lotes_faturamento"("insurancePlanId", "numeroLote");
CREATE INDEX "lotes_faturamento_insurancePlanId_idx" ON "lotes_faturamento"("insurancePlanId");
CREATE INDEX "lotes_faturamento_status_idx" ON "lotes_faturamento"("status");

ALTER TABLE "lotes_faturamento"
    ADD CONSTRAINT "lotes_faturamento_insurancePlanId_fkey"
    FOREIGN KEY ("insurancePlanId") REFERENCES "insurance_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Guias de faturamento
CREATE TABLE "guias_faturamento" (
    "id"                         TEXT NOT NULL,
    "loteId"                     TEXT,
    "insurancePlanId"            TEXT NOT NULL,
    "appointmentId"              TEXT,
    "tipo"                       "GuiaTipo" NOT NULL,
    "status"                     "GuiaStatus" NOT NULL DEFAULT 'PENDENTE',
    "numeroGuia"                 TEXT NOT NULL,
    "numeroAutorizacao"          TEXT,
    "dataAutorizacao"            TIMESTAMP(3),
    "nomeBeneficiario"           TEXT NOT NULL,
    "numeroCarteirinha"          TEXT NOT NULL,
    "validadeCarteirinha"        TEXT,
    "codigoPrestadorNaOperadora" TEXT,
    "valorApresentado"           DOUBLE PRECISION NOT NULL,
    "valorAprovado"              DOUBLE PRECISION,
    "motivoGlosa"                TEXT,
    "tipoConsulta"               INTEGER,
    "tussCode"                   TEXT,
    "cbos"                       TEXT,
    "crmExecutante"              TEXT,
    "crmEstado"                  TEXT,
    "nomeExecutante"             TEXT,
    "indicacaoAcidente"          INTEGER NOT NULL DEFAULT 9,
    "createdAt"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guias_faturamento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "guias_faturamento_appointmentId_key" ON "guias_faturamento"("appointmentId");
CREATE INDEX "guias_faturamento_insurancePlanId_idx" ON "guias_faturamento"("insurancePlanId");
CREATE INDEX "guias_faturamento_loteId_idx" ON "guias_faturamento"("loteId");
CREATE INDEX "guias_faturamento_status_idx" ON "guias_faturamento"("status");

ALTER TABLE "guias_faturamento"
    ADD CONSTRAINT "guias_faturamento_loteId_fkey"
    FOREIGN KEY ("loteId") REFERENCES "lotes_faturamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "guias_faturamento"
    ADD CONSTRAINT "guias_faturamento_insurancePlanId_fkey"
    FOREIGN KEY ("insurancePlanId") REFERENCES "insurance_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "guias_faturamento"
    ADD CONSTRAINT "guias_faturamento_appointmentId_fkey"
    FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Procedimentos da guia (SP/SADT)
CREATE TABLE "guia_procedimentos" (
    "id"            TEXT NOT NULL,
    "guiaId"        TEXT NOT NULL,
    "tussCode"      TEXT NOT NULL,
    "descricao"     TEXT NOT NULL,
    "quantidade"    DOUBLE PRECISION NOT NULL DEFAULT 1,
    "valorUnitario" DOUBLE PRECISION NOT NULL,
    "valorTotal"    DOUBLE PRECISION NOT NULL,

    CONSTRAINT "guia_procedimentos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "guia_procedimentos_guiaId_idx" ON "guia_procedimentos"("guiaId");

ALTER TABLE "guia_procedimentos"
    ADD CONSTRAINT "guia_procedimentos_guiaId_fkey"
    FOREIGN KEY ("guiaId") REFERENCES "guias_faturamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
