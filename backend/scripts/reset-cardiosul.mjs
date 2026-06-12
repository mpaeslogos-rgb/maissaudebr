// Script de reset operacional do CardioSul
// Apaga dados operacionais, mantém cadastros base

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})

async function step(label, fn) {
  process.stdout.write(`  ${label.padEnd(24)}`)
  try {
    const r = await fn()
    const count = r?.count ?? r ?? '—'
    console.log(`${count}`)
    return r
  } catch (e) {
    console.log(`ERRO: ${e.message}`)
  }
}

async function main() {
  console.log('Iniciando reset do CardioSul...')
  console.log('Database:', process.env.DATABASE_URL?.replace(/:\/\/.*@/, '://***@'))
  console.log()

  // TISS (novos — pode não ter dados ainda)
  await step('guiaProcedimentos',  () => prisma.guiaProcedimento.deleteMany())
  await step('guiasFaturamento',   () => prisma.guiaFaturamento.deleteMany())
  await step('lotesFaturamento',   () => prisma.loteFaturamento.deleteMany())

  // Estoque
  await step('stockMovements',     () => prisma.stockMovement.deleteMany())
  await step('materiais(estoque)', () => prisma.material.updateMany({ data: { currentStock: 0 } }))

  // Financeiro
  await step('doctorPayments',     () => prisma.doctorPayment.deleteMany())
  await step('payments',           () => prisma.payment.deleteMany())

  // Exames
  await step('examOrders',         () => prisma.examOrder.deleteMany())

  // Clínico
  await step('prescriptions',      () => prisma.prescription.deleteMany())
  await step('medicalRecords',     () => prisma.medicalRecord.deleteMany())

  // Agenda
  await step('appointments',       () => prisma.appointment.deleteMany())
  await step('preAppointments',    () => prisma.preAppointment.deleteMany())

  // Operacional
  await step('chats',              () => prisma.chat.deleteMany())
  await step('chatLogs',           () => prisma.chatLog.deleteMany())
  await step('auditLogs',          () => prisma.auditLog.deleteMany())
  await step('contasAPagar',       () => prisma.accountPayable.deleteMany())

  console.log('\n✅ Reset concluído.')
}

main()
  .catch(e => { console.error('ERRO:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
