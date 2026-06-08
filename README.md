# maisaudebr

Repositório principal do projeto Mais Saúde BR.

## Estrutura

- `backend/` - servidor Node.js/TypeScript com Fastify e Prisma
- `frontend/` - aplicação Next.js

## Como rodar

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Configuração de ambiente

- Backend usa `backend/.env`
- A porta do backend local é `3001`
- Frontend usa `NEXT_PUBLIC_API_URL` para apontar ao backend

Exemplo de configuração local do frontend:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Para deploy na web, defina também no backend:

```bash
CORS_ALLOW_ORIGIN=https://seu-dominio.com
```

## Relatório de atualização (2026-06-08)

- Adicionadas fixtures Cypress em `frontend/cypress/fixtures/`.
- Implementados comandos de suporte e atualizadas specs para API login.
- Tentativa de smoke local executada com backend em `http://localhost:3002` e frontend em `http://localhost:3001`, mas a instalação do Cypress ficou travada em `Unzipping Cypress`.

