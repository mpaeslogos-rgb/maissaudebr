import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
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
import { webhookRoutes } from './routes/webhook.routes'
import { configRoutes } from './routes/config'
import { boletosOcrRoutes } from './routes/boletos-ocr.routes'
import { startReminderJobs } from './jobs/reminder.job'
import { notificationsRoutes } from './routes/notifications.routes'
import { examsRoutes } from './routes/exams.routes'
import { cid10Routes } from './routes/cid10.routes'
import { usersRoutes } from './routes/users.routes'
import { auditRoutes } from './routes/audit.routes'
import { cashflowRoutes } from './routes/cashflow.routes'
import { consentsRoutes } from './routes/consents.routes'
import { leadsRoutes } from './routes/leads.routes'
import { prescriptionsRoutes } from './routes/prescriptions.routes'

const app = Fastify({ logger: true })

const WEAK_SECRETS = new Set([
  'troque-este-segredo',
  'chave-secreta-bem-grande-troque-em-producao-123456',
  'openssl rand -base64 32',
  'secret',
  'jwt_secret',
  'change_me',
])

function assertSecrets() {
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret || jwtSecret.length < 32) {
    console.error('[FATAL] JWT_SECRET deve ter pelo menos 32 caracteres')
    process.exit(1)
  }
  if (WEAK_SECRETS.has(jwtSecret)) {
    console.error('[FATAL] JWT_SECRET é um valor padrão inseguro. Defina um segredo forte em produção.')
    process.exit(1)
  }
  if (!process.env.FIELD_ENCRYPTION_KEY || process.env.FIELD_ENCRYPTION_KEY.length < 32) {
    console.warn('[WARN] FIELD_ENCRYPTION_KEY não configurada ou muito curta — dados PII não serão criptografados')
  }
}

async function bootstrap() {
  const uploadsDir = path.resolve(process.cwd(), 'uploads')
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
  }

  await app.register(fastifyStatic, {
    root: uploadsDir,
    prefix: '/uploads/',
  })

  // Security headers (CSP desativado para não quebrar uploads/static)
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })

  // Rate limiting global: 200 req/min por IP
  await app.register(rateLimit, {
    global: true,
    max: 200,
    timeWindow: '1 minute',
    errorResponseBuilder: (_req, context) => ({
      error: `Muitas requisições. Tente novamente em ${Math.ceil(context.ttl / 1000)}s`,
    }),
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

  assertSecrets()
  await app.register(jwt, {
    secret: process.env.JWT_SECRET!,
    sign: { expiresIn: '8h' },
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
  await app.register(webhookRoutes, { prefix: '/api/whatsapp' })
  await app.register(configRoutes)
  await app.register(notificationsRoutes, { prefix: '/api/notifications' })
  await app.register(examsRoutes, { prefix: '/api' })
  await app.register(cid10Routes, { prefix: '/api' })
  await app.register(usersRoutes, { prefix: '/api' })
  await app.register(auditRoutes, { prefix: '/api' })
  await app.register(cashflowRoutes, { prefix: '/api' })
  await app.register(consentsRoutes)
  await app.register(leadsRoutes)
  await app.register(prescriptionsRoutes)

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
    console.log(`Backend rodando em http://localhost:${PORT} (v2 — with users/audit/cashflow routes)`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

bootstrap()