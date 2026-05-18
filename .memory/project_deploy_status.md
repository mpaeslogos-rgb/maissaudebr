---
name: project-deploy-status
description: Status completo deploy Railway+Vercel — sistema 100% funcional com WhatsApp AI + chat features (2026-05-18)
metadata:
  type: project
---

## Stack
Next.js 14 App Router (Vercel frontend) + Fastify v5 (Railway backend) + PostgreSQL (Railway) + Prisma v5.22

## URLs em produção
- **Backend (Railway):** https://exquisite-tranquility-production-75d3.up.railway.app
- **Frontend (Vercel):** https://maissaudebr.vercel.app

## Usuário admin
- Email: `admin@maissaudebr.com` / Senha: `senha123` / Role: ADMIN

## Repositório GitHub
- `mpaeslogos-rgb/maissaudebr` — branch `master`
- **Último commit:** `d35720f` (feat: show patient age as years, months and days)
- **Dockerfile:** v12 (Railway rebuilda a cada mudança no Dockerfile)

---

## Backend (Railway) — FUNCIONANDO ✅

**Serviço**: `exquisite-tranquility` (projeto `maissaudebr`)

### Configurações Railway
- Builder: DOCKERFILE, dockerfilePath: `backend/Dockerfile`
- DATABASE_URL: `${{Postgres.DATABASE_URL}}`
- JWT_SECRET, OPENAI_API_KEY, NODE_ENV=production
- CORS_ALLOW_ORIGIN: https://maissaudebr.vercel.app
- ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN (Z-API WhatsApp)

### Lição crítica — Railway watch paths
Para forçar rebuild após mudar apenas `.ts`: alterar comentário `# vN` no `backend/Dockerfile`, commitar e push. `railway redeploy` usa commit antigo.

**Why:** Watch paths do Railway só observam `Dockerfile` e `package.json`.

### Rotas do backend
- `POST /auth/login`, `POST /auth/register`
- `GET/POST/PATCH/DELETE /patients`, `POST /patients/bulk-import`
- `GET/POST/PATCH/DELETE /doctors`
- `GET/POST/PATCH /appointments`
- `GET/POST /payments`, `POST /payments/:id/pay`, `POST /payments/:id/refund`
- `GET/POST/PATCH /medical-records`
- `GET/POST /api/exams`, `DELETE /api/exams/:id`
- `GET /api/cid10`
- `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id`, `DELETE /api/users/:id`, `POST /api/users/:id/reset-password`
- `GET /api/audit-logs`, `GET /api/audit-logs/summary`
- `GET /api/financeiro/cashflow`
- `GET /api/whatsapp/contacts`, `POST /api/whatsapp/send`
- `POST /api/whatsapp/webhook` ← recebe mensagens Z-API (sem auth)
- `GET /api/chats` ← inclui `schedulingStatus` por chat
- `GET /api/chats/:id`
- `GET /api/chats/:id/messages`
- `POST /api/chats/:id/toggle-ai` ← pausa/retoma IA
- `POST /api/chats/:id/transfer` ← transfere para médico
- `POST /api/chats/:id/return` ← desfaz transferência
- `POST /api/chats/:id/close`
- `POST /api/chat` ← chat interno com streaming SSE

### Schema Prisma — campos relevantes
- `Chat.aiPaused Boolean @default(false)` — migração: `20260518000000_add_ai_paused_to_chat`
- `Chat.status: ACTIVE | TRANSFERRED_TO_DOCTOR | CLOSED`
- `Lead.status: PENDING_SCHEDULING | SCHEDULED`
- `PreAppointment.status: PENDING | CONFIRMED | CANCELLED`

---

## Frontend (Vercel) — IMPLEMENTADO ✅

### Arquivos principais
- `frontend/app/(dashboard)/` — todas as páginas protegidas
- `frontend/contexts/AuthContext.tsx` — auth global com `hasRole()` / `can()`
- `frontend/components/Sidebar.tsx` — menu condicional por role
- `frontend/lib/api.ts` — cliente HTTP centralizado
- `frontend/lib/types.ts` — tipos TypeScript (Chat inclui `aiPaused`, `schedulingStatus`)

### Páginas implementadas
- `/dashboard` — visão geral
- `/pacientes` — CRUD + idade em anos/meses/dias
- `/medicos` — CRUD de médicos
- `/agenda` — agendamentos
- `/prontuarios` — prontuários + OCR + exames + CID-10
- `/financeiro` — pagamentos + contas a pagar + fluxo de caixa
- `/financeiro/boletos` — OCR de boletos
- `/chats` — chat WhatsApp com IA (ver seção abaixo)
- `/relatorios` — relatórios (ADMIN)
- `/configuracoes` — config da clínica (ADMIN)
- `/admin/usuarios` — CRUD de usuários (ADMIN)
- `/admin/audit-logs` — logs de auditoria (ADMIN)

---

## WhatsApp + IA (Z-API) — FUNCIONANDO ✅

Veja [[whatsapp-config-pendente]] para credenciais Z-API.

### Fluxo completo
1. Paciente envia mensagem → Z-API → `POST /api/whatsapp/webhook`
2. Webhook upsert Chat, cria ChatLog, responde 200 imediatamente
3. Se `chat.aiPaused === false`: chama `processWithAI()` em background
4. AI usa tool-calling loop (não-streaming, depth limit 5): verifica agenda, salva lead, cria pré-agendamento
5. Resposta salva no ChatLog e enviada via Z-API `send-text`

### Ferramentas da IA
- `verificar_agenda` — slots disponíveis por especialidade/data
- `salvar_lead_pre_agendamento` — cria/atualiza Lead
- `criar_pre_agendamento` — cria PreAppointment
- `registrar_intencao_atendimento` — loga intenção
- `buscar_especialidades_disponiveis` — lista especialidades

### Página de Chats (`/chats`)
- Lista de chats com polling 10s
- Mensagens com polling 5s
- **Badges de status de agendamento** (computados server-side):
  - Verde "Agendado" — PreAppointment PENDING ou CONFIRMED
  - Amarelo "Em andamento" — Lead existe, sem PreAppointment ativo
  - Vermelho "Desistiu" — PreAppointment CANCELLED
  - Sem badge — sem Lead
- **Botão IA Ativa/Pausada** — verde/âmbar, pausa a IA para o chat
- **Botão Retornar chat** — aparece quando transferido, desfaz a transferência
- Header estático (h-full, não rola com mensagens)

---

## Vercel — variável crítica
- `NEXT_PUBLIC_API_URL` = `https://exquisite-tranquility-production-75d3.up.railway.app`
