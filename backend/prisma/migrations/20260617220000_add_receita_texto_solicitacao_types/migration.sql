-- prisma-client-js migrate: unsafe
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block (PostgreSQL restriction)
ALTER TYPE "SignedDocumentType" ADD VALUE IF NOT EXISTS 'RECEITA_TEXTO';
ALTER TYPE "SignedDocumentType" ADD VALUE IF NOT EXISTS 'SOLICITACAO';
