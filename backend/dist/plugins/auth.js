"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.requireRole = requireRole;
exports.getPayload = getPayload;
// Import lazy para evitar dependência circular (auth.routes importa auth.ts e vice-versa)
async function checkRevoked(authorization) {
    if (!authorization)
        return false;
    const { isTokenRevoked } = await Promise.resolve().then(() => __importStar(require('../routes/auth.routes')));
    const token = authorization.split(' ')[1] ?? '';
    return isTokenRevoked(token);
}
/** Apenas verifica se o JWT é válido — sem checar role. */
async function authenticate(request, reply) {
    try {
        await request.jwtVerify();
        if (await checkRevoked(request.headers.authorization)) {
            return reply.code(401).send({ error: 'Token revogado. Faça login novamente.' });
        }
    }
    catch {
        reply.code(401).send({ error: 'Token inválido ou ausente' });
    }
}
/**
 * Verifica JWT e exige que o usuário tenha um dos roles informados.
 * Uso: app.addHook('preHandler', requireRole('ADMIN', 'DOCTOR'))
 */
function requireRole(...roles) {
    return async function (request, reply) {
        try {
            await request.jwtVerify();
        }
        catch {
            return reply.code(401).send({ error: 'Token inválido ou ausente' });
        }
        if (await checkRevoked(request.headers.authorization)) {
            return reply.code(401).send({ error: 'Token revogado. Faça login novamente.' });
        }
        const payload = request.user;
        if (!roles.includes(payload.role)) {
            return reply.code(403).send({ error: 'Acesso negado. Permissão insuficiente.' });
        }
    };
}
/** Extrai o payload JWT da request (já verificada). */
function getPayload(request) {
    return request.user;
}
