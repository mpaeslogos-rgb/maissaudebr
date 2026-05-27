"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.encryptDeterministic = encryptDeterministic;
exports.decryptDeterministic = decryptDeterministic;
const node_crypto_1 = require("node:crypto");
/**
 * Criptografia simétrica AES-256-GCM para campos PII (LGPD).
 *
 * Variável de ambiente: FIELD_ENCRYPTION_KEY (mínimo 32 chars).
 * Se ausente em produção o servidor deve recusar inicializar (ver server.ts).
 *
 * Formato armazenado: "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 * - IV aleatório por valor (não determinístico → não permite dedução de igualdade)
 * - Para buscas exatas (ex: CPF único), use encryptDeterministic / decryptDeterministic
 */
const ALGORITHM = 'aes-256-gcm';
function getKey() {
    const raw = process.env.FIELD_ENCRYPTION_KEY;
    if (!raw || raw.length < 32)
        return Buffer.alloc(32); // fallback silencioso em dev
    return (0, node_crypto_1.scryptSync)(raw, 'maissaudebr-salt', 32);
}
function encrypt(plaintext) {
    if (plaintext == null || plaintext === '')
        return plaintext ?? null;
    const key = getKey();
    const iv = (0, node_crypto_1.randomBytes)(12);
    const cipher = (0, node_crypto_1.createCipheriv)(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}
function decrypt(ciphertext) {
    if (ciphertext == null || ciphertext === '')
        return ciphertext ?? null;
    if (!ciphertext.includes(':'))
        return ciphertext; // dado legado não criptografado
    try {
        const [ivHex, tagHex, dataHex] = ciphertext.split(':');
        const key = getKey();
        const decipher = (0, node_crypto_1.createDecipheriv)(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
        return decipher.update(Buffer.from(dataHex, 'hex')).toString('utf8') + decipher.final('utf8');
    }
    catch {
        return ciphertext; // retorna como está se falhar (dado legado)
    }
}
/**
 * Criptografia determinística para campos usados em buscas de igualdade (CPF).
 * Usa IV fixo derivado da chave — mesmo input sempre gera mesmo output.
 * ATENÇÃO: não revela o conteúdo, mas revela igualdade entre valores.
 */
function encryptDeterministic(value) {
    if (value == null || value === '')
        return value ?? null;
    const key = getKey();
    const iv = (0, node_crypto_1.scryptSync)(key.toString('hex'), 'det-iv', 12);
    const cipher = (0, node_crypto_1.createCipheriv)(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `det:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}
function decryptDeterministic(ciphertext) {
    if (ciphertext == null || ciphertext === '')
        return ciphertext ?? null;
    if (!ciphertext.startsWith('det:'))
        return ciphertext; // dado legado
    try {
        const [, tagHex, dataHex] = ciphertext.split(':');
        const key = getKey();
        const iv = (0, node_crypto_1.scryptSync)(key.toString('hex'), 'det-iv', 12);
        const decipher = (0, node_crypto_1.createDecipheriv)(ALGORITHM, key, iv);
        decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
        return decipher.update(Buffer.from(dataHex, 'hex')).toString('utf8') + decipher.final('utf8');
    }
    catch {
        return ciphertext;
    }
}
