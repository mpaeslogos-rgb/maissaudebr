-- Fase 1: Fundação para integração Tasy
-- Adiciona tussCode ao catálogo de exames e vincula ExamOrder a convênio + guia TISS

-- ExamCatalog: código TUSS (ponte com InsuranceProcedure e Guia SP/SADT)
ALTER TABLE "exam_catalog" ADD COLUMN "tussCode" TEXT;
CREATE INDEX "exam_catalog_tussCode_idx" ON "exam_catalog"("tussCode");

-- ExamOrder: vínculo com convênio
ALTER TABLE "exam_orders" ADD COLUMN "insurancePlanId" TEXT;
ALTER TABLE "exam_orders" ADD CONSTRAINT "exam_orders_insurancePlanId_fkey"
  FOREIGN KEY ("insurancePlanId") REFERENCES "insurance_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "exam_orders_insurancePlanId_idx" ON "exam_orders"("insurancePlanId");

-- ExamOrder: vínculo com guia TISS
ALTER TABLE "exam_orders" ADD COLUMN "guiaId" TEXT;
ALTER TABLE "exam_orders" ADD CONSTRAINT "exam_orders_guiaId_fkey"
  FOREIGN KEY ("guiaId") REFERENCES "guias_faturamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "exam_orders_guiaId_idx" ON "exam_orders"("guiaId");
