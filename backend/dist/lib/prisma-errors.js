"use strict";
/**
 * Helpers para tratar erros conhecidos do Prisma de forma amigável.
 *
 * Por que existe este arquivo?
 * - O formato de `err.meta` muda entre o Prisma "clássico" e o driver adapter pg.
 * - Centralizar a leitura evita repetir essa lógica em cada rota.
 *
 * Formatos suportados:
 *   1. Prisma clássico:       err.meta.target = ['email']  ou  'email'
 *   2. Driver adapter pg:     err.meta.driverAdapterError.cause.constraint.fields = ['email']
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractUniqueViolationFields = extractUniqueViolationFields;
/**
 * Extrai os nomes dos campos que violaram uma constraint UNIQUE (P2002).
 * Retorna uma string legível (ex: "email" ou "crm, crmState") para mensagens ao usuário.
 *
 * @param meta O objeto `err.meta` de um Prisma.PrismaClientKnownRequestError com code = 'P2002'
 */
function extractUniqueViolationFields(meta) {
    if (!meta || typeof meta !== 'object')
        return 'campo único';
    const m = meta;
    // Formato clássico do Prisma
    if (Array.isArray(m.target))
        return m.target.join(', ');
    if (typeof m.target === 'string')
        return m.target;
    // Formato do driver adapter pg (Prisma 7+)
    const fields = m.driverAdapterError?.cause?.constraint?.fields;
    if (Array.isArray(fields))
        return fields.join(', ');
    return 'campo único';
}
