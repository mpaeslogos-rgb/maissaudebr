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

