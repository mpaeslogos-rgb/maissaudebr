import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import path from 'node:path'
import fs from 'node:fs'

import { healthRoutes } from './routes/health.routes'
import { authRoutes } from './routes/auth.routes'
import { appointmentsRoutes } from './routes/appointments.routes'
import { patientsRoutes } from './routes/patients.routes'
import { doctorsRoutes } from './routes/doctors.routes'
import { paymentsRoutes } from './routes/payments.routes'
import { accountsPayableRoutes } from './routes/accounts-payable.routes'
import { medicalRecordsRoutes } from './routes/medical-records.routes'
import { ocrRoutes } from './routes/ocr.routes'
import { chatRoutes } from './routes/chat.routes'
import { chatRoutes as aiChatRoutes } from './routes/chat'
import { whatsappRoutes } from './routes/whatsapp.routes'
import { configRoutes } from './routes/config'
import { boletosOcrRoutes } from './routes/boletos-ocr.routes'
import { startReminderJobs } from './jobs/reminder.job'
import { notificationsRoutes } from './routes/notifications.routes'
import { examsRoutes } from './routes/exams.routes'
import { cid10Routes } from './routes/cid10.routes'
import { usersRoutes } from './routes/users.routes'
import { auditRoutes } from './routes/audit.routes'
import { cashflowRoutes } from './routes/cashflow.routes'

const app = Fastify({ logger: true })

async function bootstrap() {
  const uploadsDir = path.resolve(process.cwd(), 'uploads')
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
  }

  await app.register(fastifyStatic, {
    root: uploadsDir,
    prefix: '/uploads/',
  })

  const allowedOrigins = process.env.CORS_ALLOW_ORIGIN
    ? process.env.CORS_ALLOW_ORIGIN.split(',').map(origin => origin.trim())
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002']

  await app.register(cors, {
    origin: allowedOrigins.includes('*') ? true : allowedOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Authorization'],
  })

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'troque-este-segredo',
  })

  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 },
  })

  await app.register(healthRoutes)
  await app.register(authRoutes)
  await app.register(appointmentsRoutes)
  await app.register(patientsRoutes)
  await app.register(doctorsRoutes)
  await app.register(paymentsRoutes)
  await app.register(accountsPayableRoutes)
  await app.register(medicalRecordsRoutes)
  await app.register(ocrRoutes, { prefix: '/api' })
  await app.register(boletosOcrRoutes, { prefix: '/api/financial/ocr' })
  await app.register(chatRoutes, { prefix: '/api' })
  await app.register(aiChatRoutes, { prefix: '/api' })
  await app.register(whatsappRoutes, { prefix: '/api/whatsapp' })
  await app.register(configRoutes)
  await app.register(notificationsRoutes, { prefix: '/api/notifications' })
  await app.register(examsRoutes, { prefix: '/api/exams' })
  await app.register(cid10Routes, { prefix: '/api/cid10' })
  await app.register(usersRoutes, { prefix: '/api/users' })
  await app.register(auditRoutes, { prefix: '/api/audit-logs' })
  await app.register(cashflowRoutes, { prefix: '/api/financeiro' })

  const PORT = Number(process.env.PORT) || 3001
  const HOST = '0.0.0.0'

  await app.ready()

  if (process.env.NODE_ENV !== 'production') {
    console.log('=== ROTAS REGISTRADAS ===')
    console.log(app.printRoutes())
  }

  startReminderJobs()

  try {
    await app.listen({ port: PORT, host: HOST })
    console.log(`Backend rodando em http://localhost:${PORT}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

bootstrap()