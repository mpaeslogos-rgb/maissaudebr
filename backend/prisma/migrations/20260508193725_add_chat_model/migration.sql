-- CreateEnum
CREATE TYPE "ChatStatus" AS ENUM ('ACTIVE', 'TRANSFERRED_TO_DOCTOR', 'CLOSED');

-- CreateTable
CREATE TABLE "chats" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "patientId" TEXT,
    "status" "ChatStatus" NOT NULL DEFAULT 'ACTIVE',
    "transferredToDoctorId" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chats_phone_key" ON "chats"("phone");

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_transferredToDoctorId_fkey" FOREIGN KEY ("transferredToDoctorId") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
