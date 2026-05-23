-- LGPD Art. 7 e Art. 9 — Registro de Consentimento do Titular

CREATE TABLE "consents" (
    "id"         TEXT NOT NULL,
    "patientId"  TEXT NOT NULL,
    "purpose"    TEXT NOT NULL,
    "granted"    BOOLEAN NOT NULL DEFAULT true,
    "grantedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt"  TIMESTAMP(3),
    "ipAddress"  TEXT,
    "userAgent"  TEXT,
    "notes"      TEXT,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "consents_patientId_idx" ON "consents"("patientId");
CREATE INDEX "consents_patientId_purpose_idx" ON "consents"("patientId", "purpose");

ALTER TABLE "consents" ADD CONSTRAINT "consents_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
