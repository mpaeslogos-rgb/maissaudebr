CONTEXT

# Continuação: Backend maissaudebr (sistema de gestão de clínica médica)

## Contexto geral
Estou desenvolvendo um sistema de gestão de clínica médica chamado **maissaudebr** no Windows. Já avancei bastante em outro chat e preciso continuar daqui.

**Sou iniciante em backend.** Prefiro:
- Instruções claras com comandos prontos para copiar/colar
- Validação em cada etapa (uma evolução por vez)
- Explicação do "porquê" de cada passo
- Respostas em português

## Stack
- **Frontend** (já rodando em :3000): Next.js 14.2.35
- **Backend** (rodando em :3001): Fastify 5.8.5 + TypeScript 6 + Prisma 7.8 + PostgreSQL (`npx prisma dev` local nas portas 51213-51215) + JWT + Zod + OpenAI SDK + bcryptjs
- **Localização:** `C:\Users\Marcos Paes\OneDrive\Desktop\maissaudebr\` (subpastas `frontend/` e `backend/`)
- **Teste de API:** extensão **REST Client** no VS Code, arquivo `backend/teste.http`

## Schema Prisma (resumido)
Modelos: `User` (UserRole: ADMIN/DOCTOR/SECRETARY/FINANCIAL), `Doctor` (1:1 com User), `Patient`, `Appointment` (status enum), `Payment` (PaymentMethod: PIX/BOLETO/CREDIT_CARD/DEBIT_CARD; PaymentStatus: PENDING/PAID/OVERDUE/CANCELLED/REFUNDED), `MedicalRecord` (vinculado a appointment + patient + doctor), `AccountPayable` (com campos OCR), `AuditLog`.

`Payment` tem `appointmentId` opcional (permite pagamento avulso) e `@unique` (1 pagamento por consulta).

## Estrutura de pastas do backend
```
src/
├── server.ts                          ← entry point Fastify
├── lib/prisma.ts                      ← PrismaClient com PrismaPg adapter + singleton
├── plugins/auth.ts                    ← função authenticate (jwtVerify)
├── types/fastify-jwt.d.ts             ← tipagem do payload JWT (sub, role, name)
├── routes/
│   ├── health.routes.ts               ← /health + /db-check
│   ├── auth.routes.ts                 ← /auth/register + /auth/login
│   ├── patients.routes.ts             ← CRUD básico
│   ├── doctors.routes.ts              ← CRUD (sem DELETE)
│   └── appointments.routes.ts         ← CRUD com conflito de horário
└── services/
    ├── doctors.service.ts             ← cria User+Doctor em prisma.$transaction
    └── appointments.service.ts        ← lógica de hasConflict + soft delete
```

## Padrão arquitetural já estabelecido
- **Routes** lidam com HTTP (Zod, status codes, handler de erros traduzindo strings em códigos).
- **Services** carregam regras de negócio e lançam erros como strings tipo `'PATIENT_NOT_FOUND'`, `'SCHEDULE_CONFLICT'`.
- Todas as rotas protegidas usam `app.addHook('preHandler', authenticate)` no topo.
- JWT payload: `{ sub: userId, role, name }`, expira em 8h.
- Soft delete via mudança de status (nunca delete físico em saúde/finanças).

## Status atual
✅ Backend rodando sem erros (`npm run dev`)
✅ Banco sincronizado (`npx prisma db push`)
✅ Auth completo (register + login + JWT funcionando ponta a ponta)
✅ CRUD de Patients, Doctors e Appointments testados
✅ **Conflito de horário detectado corretamente (409)**
✅ Soft delete validado

## Dados de teste já no banco
- **Admin login:** `admin@maissaudebr.com` / `senha123`
- **Doctor login:** `ana.souza@maissaudebr.com` / `senha123`
- **Patient ID:** `30b993f7-0627-4b80-bbdb-5bcf953a3c91` (João da Silva)
- **Doctor ID:** `34b6187e-5bb7-4c92-9825-974c9abfd59a` (Dra. Ana Souza, Cardiologia, R$ 350)
- **Appointment ID:** `fe0ee36a-00d7-4a42-8686-19c01950e7b1` (status CANCELLED após teste)

## Próximo passo: Etapa 2 — Payments
Criar:
- `POST /payments` — registrar pagamento (vinculado a appointment OU avulso)
- `GET /payments` — listar com filtros (período, status, método, patientId)
- `GET /payments/summary` — totais agregados por período (útil para dashboard)
- `PATCH /payments/:id` — marcar como pago / estornar

Seguir o **mesmo padrão arquitetural**: criar `src/services/payments.service.ts` + `src/routes/payments.routes.ts`, registrar no `server.ts`, e me passar testes via `teste.http`.

## Etapas seguintes (sequência planejada)
3. MedicalRecords (com restrição de role DOCTOR)
4. OCR com OpenAI (upload multipart → GPT-4o Vision → JSON estruturado)
5. AccountsPayable
6. Conectar frontend Next.js ao backend

## O que preciso agora
Me guie passo a passo na **Etapa 2 (Payments)**, mantendo o padrão arquitetural já estabelecido (services + routes + Zod + handler de erros), uma evolução por vez, com validação via REST Client antes de avançar.

"id": "316cb984-a576-4c7a-9f3a-89c14f490e38", ETAPA 2.1