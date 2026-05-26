-- Backfill: pacientes já anonimizados antes da coluna deletedAt existir
-- Identifica pelo padrão de nome gerado pelo DELETE handler
UPDATE "patients"
SET "deletedAt" = NOW()
WHERE "fullName" LIKE 'ANONIMIZADO-%'
  AND "deletedAt" IS NULL;
