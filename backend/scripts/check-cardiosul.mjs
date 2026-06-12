import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const checks = [
  ['appointments',      () => prisma.appointment.count()],
  ['medicalRecords',    () => prisma.medicalRecord.count()],
  ['prescriptions',     () => prisma.prescription.count()],
  ['payments',          () => prisma.payment.count()],
  ['doctorPayments',    () => prisma.doctorPayment.count()],
  ['accountsPayable',   () => prisma.accountPayable.count()],
  ['examOrders',        () => prisma.examOrder.count()],
  ['stockMovements',    () => prisma.stockMovement.count()],
  ['guiasFaturamento',  () => prisma.guiaFaturamento.count()],
  ['lotesFaturamento',  () => prisma.loteFaturamento.count()],
  ['chats',             () => prisma.chat.count()],
  ['chatLogs',          () => prisma.chatLog.count()],
  ['auditLogs',         () => prisma.auditLog.count()],
  ['preAppointments',   () => prisma.preAppointment.count()],
]

const cadastros = [
  ['users',             () => prisma.user.count()],
  ['doctors',           () => prisma.doctor.count()],
  ['patients',          () => prisma.patient.count()],
  ['insurancePlans',    () => prisma.insurancePlan.count()],
  ['materials',         () => prisma.material.count()],
  ['examCatalog',       () => prisma.examCatalog.count()],
  ['leads',             () => prisma.lead.count()],
]

console.log('\n=== DADOS OPERACIONAIS (devem estar zerados) ===')
for (const [label, fn] of checks) {
  const v = await fn()
  const flag = v > 0 ? '  ⚠️  PENDENTE' : '  ✅'
  console.log(`  ${label.padEnd(22)} ${String(v).padStart(4)}${flag}`)
}

console.log('\n=== CADASTROS (devem ter dados) ===')
for (const [label, fn] of cadastros) {
  const v = await fn()
  const flag = v === 0 ? '  ⚠️  VAZIO' : '  ✅'
  console.log(`  ${label.padEnd(22)} ${String(v).padStart(4)}${flag}`)
}

await prisma.$disconnect()
