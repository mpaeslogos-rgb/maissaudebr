-- CPF do médico (necessário para prescrição digital CFM)
ALTER TABLE "doctors" ADD COLUMN "cpf" TEXT;

-- Dados da clínica para CfmLocalAtendimento (CNES, CNPJ, endereço)
ALTER TABLE "configs" ADD COLUMN "cnpj" TEXT NOT NULL DEFAULT '';
ALTER TABLE "configs" ADD COLUMN "cnes" TEXT NOT NULL DEFAULT '';
ALTER TABLE "configs" ADD COLUMN "address" TEXT NOT NULL DEFAULT '';
