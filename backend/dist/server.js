"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const helmet_1 = __importDefault(require("@fastify/helmet"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const multipart_1 = __importDefault(require("@fastify/multipart"));
const rate_limit_1 = __importDefault(require("@fastify/rate-limit"));
const static_1 = __importDefault(require("@fastify/static"));
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const health_routes_1 = require("./routes/health.routes");
const auth_routes_1 = require("./routes/auth.routes");
const appointments_routes_1 = require("./routes/appointments.routes");
const patients_routes_1 = require("./routes/patients.routes");
const doctors_routes_1 = require("./routes/doctors.routes");
const payments_routes_1 = require("./routes/payments.routes");
const accounts_payable_routes_1 = require("./routes/accounts-payable.routes");
const medical_records_routes_1 = require("./routes/medical-records.routes");
const ocr_routes_1 = require("./routes/ocr.routes");
const chat_routes_1 = require("./routes/chat.routes");
const chat_1 = require("./routes/chat");
const whatsapp_routes_1 = require("./routes/whatsapp.routes");
const webhook_routes_1 = require("./routes/webhook.routes");
const config_1 = require("./routes/config");
const boletos_ocr_routes_1 = require("./routes/boletos-ocr.routes");
const reminder_job_1 = require("./jobs/reminder.job");
const notifications_routes_1 = require("./routes/notifications.routes");
const exams_routes_1 = require("./routes/exams.routes");
const cid10_routes_1 = require("./routes/cid10.routes");
const users_routes_1 = require("./routes/users.routes");
const audit_routes_1 = require("./routes/audit.routes");
const cashflow_routes_1 = require("./routes/cashflow.routes");
const consents_routes_1 = require("./routes/consents.routes");
const leads_routes_1 = require("./routes/leads.routes");
const prescriptions_routes_1 = require("./routes/prescriptions.routes");
const doctor_payments_routes_1 = require("./routes/doctor-payments.routes");
const exam_catalog_routes_1 = require("./routes/exam-catalog.routes");
const exam_orders_routes_1 = require("./routes/exam-orders.routes");
const exam_packages_routes_1 = require("./routes/exam-packages.routes");
const insurance_plans_routes_1 = require("./routes/insurance-plans.routes");
const stock_routes_1 = require("./routes/stock.routes");
const tiss_routes_1 = require("./routes/tiss.routes");
const preventivo_programs_routes_1 = require("./routes/preventivo-programs.routes");
const patient_enrollments_routes_1 = require("./routes/patient-enrollments.routes");
const metabolic_markers_routes_1 = require("./routes/metabolic-markers.routes");
const nps_routes_1 = require("./routes/nps.routes");
const analytics_routes_1 = require("./routes/analytics.routes");
const check_ins_routes_1 = require("./routes/check-ins.routes");
const atestados_routes_1 = require("./routes/atestados.routes");
const digital_signature_routes_1 = require("./routes/digital-signature.routes");
const app = (0, fastify_1.default)({ logger: true });
const WEAK_SECRETS = new Set([
    'troque-este-segredo',
    'chave-secreta-bem-grande-troque-em-producao-123456',
    'openssl rand -base64 32',
    'secret',
    'jwt_secret',
    'change_me',
]);
function assertSecrets() {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret.length < 32) {
        console.error('[FATAL] JWT_SECRET deve ter pelo menos 32 caracteres');
        process.exit(1);
    }
    if (WEAK_SECRETS.has(jwtSecret)) {
        console.error('[FATAL] JWT_SECRET é um valor padrão inseguro. Defina um segredo forte em produção.');
        process.exit(1);
    }
    if (!process.env.FIELD_ENCRYPTION_KEY || process.env.FIELD_ENCRYPTION_KEY.length < 32) {
        console.warn('[WARN] FIELD_ENCRYPTION_KEY não configurada ou muito curta — dados PII não serão criptografados');
    }
}
async function bootstrap() {
    const uploadsDir = node_path_1.default.resolve(process.cwd(), 'uploads');
    if (!node_fs_1.default.existsSync(uploadsDir)) {
        node_fs_1.default.mkdirSync(uploadsDir, { recursive: true });
    }
    await app.register(static_1.default, {
        root: uploadsDir,
        prefix: '/uploads/',
    });
    // Security headers (CSP desativado para não quebrar uploads/static)
    await app.register(helmet_1.default, {
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    });
    // Rate limiting global: 200 req/min por IP
    await app.register(rate_limit_1.default, {
        global: true,
        max: 200,
        timeWindow: '1 minute',
        errorResponseBuilder: (_req, context) => ({
            error: `Muitas requisições. Tente novamente em ${Math.ceil(context.ttl / 1000)}s`,
        }),
    });
    const allowedOrigins = process.env.CORS_ALLOW_ORIGIN
        ? process.env.CORS_ALLOW_ORIGIN.split(',').map(origin => origin.trim())
        : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];
    await app.register(cors_1.default, {
        origin: allowedOrigins.includes('*') ? true : allowedOrigins,
        credentials: true,
        methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        exposedHeaders: ['Authorization'],
    });
    assertSecrets();
    await app.register(jwt_1.default, {
        secret: process.env.JWT_SECRET,
        sign: { expiresIn: '8h' },
    });
    await app.register(multipart_1.default, {
        limits: { fileSize: 10 * 1024 * 1024 },
    });
    await app.register(health_routes_1.healthRoutes);
    await app.register(auth_routes_1.authRoutes);
    await app.register(appointments_routes_1.appointmentsRoutes);
    await app.register(patients_routes_1.patientsRoutes);
    await app.register(doctors_routes_1.doctorsRoutes);
    await app.register(payments_routes_1.paymentsRoutes);
    await app.register(accounts_payable_routes_1.accountsPayableRoutes);
    await app.register(medical_records_routes_1.medicalRecordsRoutes);
    await app.register(ocr_routes_1.ocrRoutes, { prefix: '/api' });
    await app.register(boletos_ocr_routes_1.boletosOcrRoutes, { prefix: '/api/financial/ocr' });
    await app.register(chat_routes_1.chatRoutes, { prefix: '/api' });
    await app.register(chat_1.chatRoutes, { prefix: '/api' });
    await app.register(whatsapp_routes_1.whatsappRoutes, { prefix: '/api/whatsapp' });
    await app.register(webhook_routes_1.webhookRoutes, { prefix: '/api/whatsapp' });
    await app.register(config_1.configRoutes);
    await app.register(notifications_routes_1.notificationsRoutes, { prefix: '/api/notifications' });
    await app.register(exams_routes_1.examsRoutes, { prefix: '/api' });
    await app.register(cid10_routes_1.cid10Routes, { prefix: '/api' });
    await app.register(users_routes_1.usersRoutes, { prefix: '/api' });
    await app.register(audit_routes_1.auditRoutes, { prefix: '/api' });
    await app.register(cashflow_routes_1.cashflowRoutes, { prefix: '/api' });
    await app.register(consents_routes_1.consentsRoutes);
    await app.register(leads_routes_1.leadsRoutes);
    await app.register(prescriptions_routes_1.prescriptionsRoutes);
    await app.register(doctor_payments_routes_1.doctorPaymentsRoutes);
    await app.register(exam_catalog_routes_1.examCatalogRoutes);
    await app.register(exam_orders_routes_1.examOrdersRoutes);
    await app.register(exam_packages_routes_1.examPackagesRoutes);
    await app.register(insurance_plans_routes_1.insurancePlansRoutes);
    await app.register(stock_routes_1.stockRoutes);
    await app.register(tiss_routes_1.tissRoutes, { prefix: '/api' });
    await app.register(preventivo_programs_routes_1.preventivoProgramsRoutes);
    await app.register(patient_enrollments_routes_1.patientEnrollmentsRoutes);
    await app.register(metabolic_markers_routes_1.metabolicMarkersRoutes);
    await app.register(nps_routes_1.npsRoutes);
    await app.register(check_ins_routes_1.checkInsRoutes);
    await app.register(analytics_routes_1.analyticsRoutes);
    await app.register(atestados_routes_1.atestadosRoutes);
    await app.register(digital_signature_routes_1.digitalSignatureRoutes);
    const PORT = Number(process.env.PORT) || 3001;
    const HOST = '0.0.0.0';
    await app.ready();
    if (process.env.NODE_ENV !== 'production') {
        console.log('=== ROTAS REGISTRADAS ===');
        console.log(app.printRoutes());
    }
    (0, reminder_job_1.startReminderJobs)();
    try {
        await app.listen({ port: PORT, host: HOST });
        console.log(`Backend rodando em http://localhost:${PORT} (v2 — with users/audit/cashflow routes)`);
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}
bootstrap();
