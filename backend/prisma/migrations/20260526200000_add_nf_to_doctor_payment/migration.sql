-- Adiciona campos de Nota Fiscal / Recibo ao repasse do médico
ALTER TABLE "doctor_payments" ADD COLUMN "nfNumber"  TEXT;
ALTER TABLE "doctor_payments" ADD COLUMN "nfFileUrl" TEXT;
