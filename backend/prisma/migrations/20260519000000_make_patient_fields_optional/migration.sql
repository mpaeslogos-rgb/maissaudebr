-- AlterTable: tornar cpf, birthDate e gender opcionais
-- Necessário para criar pacientes automaticamente via agendamento WhatsApp
ALTER TABLE "patients" ALTER COLUMN "cpf" DROP NOT NULL;
ALTER TABLE "patients" ALTER COLUMN "birthDate" DROP NOT NULL;
ALTER TABLE "patients" ALTER COLUMN "gender" DROP NOT NULL;
