-- LGPD: campo deletedAt para marcar pacientes com dados anonimizados (Art. 18)
-- Pacientes com deletedAt preenchido não aparecem na lista principal
ALTER TABLE "patients" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "patients_deletedAt_idx" ON "patients"("deletedAt");
