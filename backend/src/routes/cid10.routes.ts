import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { searchCid10 } from '../data/cid10'

const querySchema = z.object({
  q:     z.string().min(2).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export async function cid10Routes(app: FastifyInstance) {
  // GET /api/cid10?q=hipertensão&limit=10
  // Público — não requer autenticação (dados abertos)
  app.get('/', async (request, reply) => {
    const parsed = querySchema.safeParse(request.query)
    if (!parsed.success) return reply.code(400).send({ error: 'Parâmetro "q" obrigatório (mínimo 2 caracteres).' })
    const { q, limit } = parsed.data
    const results = searchCid10(q, limit)
    return reply.send({ data: results, total: results.length })
  })
}
