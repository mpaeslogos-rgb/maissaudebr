# v36 — feat: Assinatura Digital (Vidaas/BirDI/Mock), Atestados DB, PDF generator
FROM node:22-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    graphicsmagick \
    ghostscript \
    openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy 2>&1; npm start"]
