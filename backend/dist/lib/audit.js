"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAudit = logAudit;
const prisma2_1 = require("./prisma2");
// Campos que NÃO devem aparecer em diffs (senhas, tokens)
const SENSITIVE_OMIT = new Set(['passwordHash', 'password', 'token', 'secret']);
/** Gera diff entre dois objetos, omitindo campos sensíveis */
function buildDiff(before, after) {
    const diff = {};
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
        if (SENSITIVE_OMIT.has(key))
            continue;
        if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
            diff[key] = { before: before[key] ?? null, after: after[key] ?? null };
        }
    }
    return diff;
}
/**
 * Registra um evento de auditoria em background.
 * Fire-and-forget: erros aqui não devem derrubar a requisição principal.
 * Quando before+after são fornecidos, grava o diff dos campos alterados.
 */
function logAudit(params) {
    const { userId, action, entity, entityId, metadata, before, after, request } = params;
    const ipAddress = request?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ??
        request?.ip ??
        null;
    const userAgent = request?.headers?.['user-agent'] ?? null;
    const enrichedMeta = { ...metadata };
    if (before && after) {
        enrichedMeta.diff = buildDiff(before, after);
    }
    prisma2_1.prisma.auditLog
        .create({
        data: {
            userId: userId ?? null,
            action,
            entity,
            entityId: entityId ?? null,
            metadata: Object.keys(enrichedMeta).length > 0 ? enrichedMeta : undefined,
            ipAddress,
            userAgent,
        },
    })
        .catch((err) => {
        console.error('[audit] failed to write audit log:', err?.message ?? err);
    });
}
