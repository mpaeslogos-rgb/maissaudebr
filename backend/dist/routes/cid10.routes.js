"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cid10Routes = cid10Routes;
const zod_1 = require("zod");
const cid10_1 = require("../data/cid10");
const querySchema = zod_1.z.object({
    q: zod_1.z.string().min(2).max(100),
    limit: zod_1.z.coerce.number().int().min(1).max(50).default(20),
});
async function cid10Routes(app) {
    // GET /api/cid10?q=hipertensão&limit=10
    // Público — não requer autenticação (dados abertos)
    app.get('/cid10', async (request, reply) => {
        const parsed = querySchema.safeParse(request.query);
        if (!parsed.success)
            return reply.code(400).send({ error: 'Parâmetro "q" obrigatório (mínimo 2 caracteres).' });
        const { q, limit } = parsed.data;
        const results = (0, cid10_1.searchCid10)(q, limit);
        return reply.send({ data: results, total: results.length });
    });
}
