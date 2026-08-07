#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/.."

echo "==> Subindo Postgres local (docker-compose)..."
docker compose -f backend/docker-compose.yml up -d

echo "==> Aguardando Postgres ficar pronto..."
until docker compose -f backend/docker-compose.yml exec -T postgres pg_isready -U maissaudebr -d maissaudebr > /dev/null 2>&1; do
  sleep 1
done

echo "==> Instalando dependências do backend..."
cd backend
npm install

if [ ! -f .env ]; then
  echo "==> Criando backend/.env (Codespace)..."
  JWT_SECRET="$(openssl rand -base64 32)"
  cat > .env <<EOF
DATABASE_URL=postgresql://maissaudebr:maissaudebr_dev_password@localhost:5432/maissaudebr
JWT_SECRET=${JWT_SECRET}
NODE_ENV=development
PORT=3001
CORS_ALLOW_ORIGIN=http://localhost:3000
# Placeholder — só evita o crash na subida (o cliente OpenAI é instanciado no
# import de ocr.routes.ts). OCR/IA não funcionam de verdade sem uma chave real.
OPENAI_API_KEY=sk-placeholder-codespace-not-real
EOF
fi

echo "==> Rodando migrations..."
npx prisma migrate deploy
npx prisma generate

cd ../frontend
echo "==> Instalando dependências do frontend..."
npm install

echo "==> Setup completo. Rode 'npm run dev' em backend/ e frontend/ (em terminais separados) para subir o app."
