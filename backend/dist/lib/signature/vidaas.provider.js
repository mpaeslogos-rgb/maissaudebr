"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VidaasProvider = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
// Vidaas (Valid Certificadora) — ICP-Brasil cloud certificate
// Docs: https://valid-sa.atlassian.net/wiki/spaces/PDD/pages/958365697
// Env vars needed:
//   VIDAAS_CLIENT_ID
//   VIDAAS_CLIENT_SECRET
//   VIDAAS_BASE_URL  (default: https://certificado.vidaas.com.br)
//   BACKEND_URL      (for OAuth callback)
const VIDAAS_BASE = process.env.VIDAAS_BASE_URL ?? "https://certificado.vidaas.com.br";
class VidaasProvider {
    name = "VIDAAS";
    clientId = process.env.VIDAAS_CLIENT_ID ?? "";
    clientSecret = process.env.VIDAAS_CLIENT_SECRET ?? "";
    async init(params) {
        const callbackUrl = `${process.env.BACKEND_URL ?? "http://localhost:3001"}/digital-signature/callback`;
        const state = params.signatureId;
        // Vidaas OAuth2 PKCE flow
        const codeVerifier = crypto_1.default.randomBytes(32).toString("base64url");
        const codeChallenge = crypto_1.default.createHash("sha256").update(codeVerifier).digest("base64url");
        const url = new URL(`${VIDAAS_BASE}/v0/oauth/authorize`);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("client_id", this.clientId);
        url.searchParams.set("redirect_uri", callbackUrl);
        url.searchParams.set("scope", "signature_session");
        url.searchParams.set("state", state);
        url.searchParams.set("code_challenge", codeChallenge);
        url.searchParams.set("code_challenge_method", "S256");
        url.searchParams.set("cpf", params.doctorCpf?.replace(/\D/g, "") ?? "");
        return { redirectUrl: url.toString() };
    }
    async sign(pdfBuffer, params) {
        const { code } = params;
        if (!code)
            throw new Error("Vidaas: authorization code ausente no callback");
        // Troca code por signature_session token
        const tokenResp = await axios_1.default.post(`${VIDAAS_BASE}/v0/oauth/token`, {
            grant_type: "authorization_code",
            code,
            client_id: this.clientId,
            client_secret: this.clientSecret,
        });
        const sessionToken = tokenResp.data.signature_session;
        // Calcula hash SHA-256 do PDF
        const documentHash = crypto_1.default.createHash("sha256").update(pdfBuffer).digest("hex");
        // Solicita assinatura PAdES (PDF com assinatura embutida)
        const signResp = await axios_1.default.post(`${VIDAAS_BASE}/v1/signatures`, {
            hashes: [
                {
                    id: "doc-1",
                    alias: "Documento Médico",
                    hash: documentHash,
                    hash_algorithm: "SHA256",
                    signature_format: "PAdES_AD_RB",
                },
            ],
        }, { headers: { Authorization: `Bearer ${sessionToken}` } });
        const signedBase64 = signResp.data.signatures?.[0]?.file_base64_encoded;
        if (!signedBase64)
            throw new Error("Vidaas: resposta de assinatura inválida");
        const signedBuffer = Buffer.from(signedBase64, "base64");
        const signerName = signResp.data.signatures?.[0]?.signer_name ?? "Desconhecido";
        const signerCpf = signResp.data.signatures?.[0]?.signer_cpf ?? "";
        return {
            signedBuffer,
            result: { signerName, signerCpf, signedAt: new Date() },
        };
    }
}
exports.VidaasProvider = VidaasProvider;
