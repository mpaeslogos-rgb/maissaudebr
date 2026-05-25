-- AlterTable: expand leads with all importable patient fields
ALTER TABLE "leads" ADD COLUMN "cpf"                   TEXT;
ALTER TABLE "leads" ADD COLUMN "rg"                    TEXT;
ALTER TABLE "leads" ADD COLUMN "birthDate"             TIMESTAMP(3);
ALTER TABLE "leads" ADD COLUMN "gender"                TEXT;
ALTER TABLE "leads" ADD COLUMN "email"                 TEXT;
ALTER TABLE "leads" ADD COLUMN "zipCode"               TEXT;
ALTER TABLE "leads" ADD COLUMN "street"                TEXT;
ALTER TABLE "leads" ADD COLUMN "number"                TEXT;
ALTER TABLE "leads" ADD COLUMN "complement"            TEXT;
ALTER TABLE "leads" ADD COLUMN "neighborhood"          TEXT;
ALTER TABLE "leads" ADD COLUMN "city"                  TEXT;
ALTER TABLE "leads" ADD COLUMN "state"                 TEXT;
ALTER TABLE "leads" ADD COLUMN "bloodType"             TEXT;
ALTER TABLE "leads" ADD COLUMN "allergies"             TEXT;
ALTER TABLE "leads" ADD COLUMN "notes"                 TEXT;
ALTER TABLE "leads" ADD COLUMN "healthInsurance"       TEXT;
ALTER TABLE "leads" ADD COLUMN "healthInsuranceNumber" TEXT;
