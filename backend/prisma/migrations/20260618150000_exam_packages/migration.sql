-- CreateTable
CREATE TABLE "exam_packages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "doctorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_package_items" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,

    CONSTRAINT "exam_package_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exam_package_items_packageId_catalogId_key" ON "exam_package_items"("packageId", "catalogId");

-- AddForeignKey
ALTER TABLE "exam_packages" ADD CONSTRAINT "exam_packages_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_package_items" ADD CONSTRAINT "exam_package_items_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "exam_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_package_items" ADD CONSTRAINT "exam_package_items_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "exam_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
