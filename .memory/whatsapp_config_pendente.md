---
name: whatsapp-config-pendente
description: WhatsApp configurado e funcionando via Z-API — IA responde pacientes e agenda consultas (2026-05-18)
metadata:
  type: project
---

WhatsApp integrado e funcionando via **Z-API** (z-api.io). Evolution API foi descartada pois Railway bloqueia conexões Baileys (IPs de datacenter bloqueados pela Meta).

## Configuração atual (FUNCIONANDO ✅)

- **Provedor:** Z-API (z-api.io)
- **Instância:** `3F3514193C94B20E8795EE63DD404397`
- **Número conectado:** 11999963756 (WhatsApp Business)

## Variáveis no Railway (serviço exquisite-tranquility)

- `ZAPI_INSTANCE_ID` = `3F3514193C94B20E8795EE63DD404397`
- `ZAPI_TOKEN` = `4BCC174D00674FB1D6546522`
- `ZAPI_CLIENT_TOKEN` = `Fb60e6d339d8c477084ceef962f82d86aS`

## Webhook Z-API
- URL configurada no painel Z-API: `https://exquisite-tranquility-production-75d3.up.railway.app/api/whatsapp/webhook`
- Tipo: `ReceivedCallback` (apenas mensagens recebidas)
- **"Notificar as enviadas por mim também" deve estar DESLIGADO** — caso contrário a IA entra em loop respondendo as próprias mensagens

## Endpoint de envio

`POST https://api.z-api.io/instances/{instanceId}/token/{token}/send-text`
Headers: `Client-Token: {clientToken}`
Body: `{ "phone": "5511999999999", "message": "texto" }`

## Arquivo do webhook
`backend/src/routes/webhook.routes.ts` — registrado em `server.ts` sem auth (`prefix: '/api/whatsapp'`, separado das rotas com `requireRole`)

## Infraestrutura descartada
- Evolution API (`lucid-forgiveness` no Railway) — deletada
- Redis — deletado

**Why:** Baileys é bloqueado por WhatsApp em IPs de datacenter. Z-API hospeda a conexão em IPs residenciais.
