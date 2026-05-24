-- Horário de atendimento por médico (início e término)

ALTER TABLE "doctors"
  ADD COLUMN "workStartHour" INTEGER NOT NULL DEFAULT 8,
  ADD COLUMN "workEndHour"   INTEGER NOT NULL DEFAULT 18;
