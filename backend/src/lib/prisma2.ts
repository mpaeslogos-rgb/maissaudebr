import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./dev.db'
}

const adapter = new PrismaBetterSqlite3({
  connectionString: process.env.DATABASE_URL,
})

export const prisma = new PrismaClient({
  adapter,
})
