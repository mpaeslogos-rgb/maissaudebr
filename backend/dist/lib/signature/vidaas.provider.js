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
        return { redirectUrl: url.toString(), codeVerifier };
    }
    async sign(pdfBuffer, params) {
        const { code, codeVerifier } = params;
        if (!code)
            throw new Error("Vidaas: authorization code ausente no callback");
        if (!codeVerifier)
            throw new Error("Vidaas: code_verifier ausente — PKCE comprometido");
        const callbackUrl = `${process.env.BACKEND_URL ?? "http://localhost:3001"}/digital-signature/callback`;
        let tokenResp;
        try {
            tokenResp = await axios_1.default.post(`${VIDAAS_BASE}/v0/oauth/token`, new URLSearchParams({
                grant_type: "authorization_code",
                code,
                client_id: this.clientId,
                client_secret: this.clientSecret,
                redirect_uri: callbackUrl,
                code_verifier: codeVerifier,
            }), { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
        }
        catch (e) {
            const detail = e?.response ? `${e.response.status} ${JSON.stringify(e.response.data)}` : e.message;
            throw new Error(`Vidaas token exchange falhou: ${detail}`);
        }
        const accessToken = tokenResp.data.access_token;
        const signerCpf = tokenResp.data.authorized_identification ?? "";
        const hashBase64 = crypto_1.default.createHash("sha256").update(pdfBuffer).digest("base64");
        let signResp;
        try {
            signResp = await axios_1.default.post(`${VIDAAS_BASE}/v0/oauth/signature`, {
                hashes: [
                    {
                        id: "doc-1",
                        alias: "Documento Médico",
                        hash: hashBase64,
                        hash_algorithm: "2.16.840.1.101.3.4.2.1",
                        signature_format: "PAdES_AD_RB",
                        base64_content: pdfBuffer.toString("base64"),
                    },
                ],
            }, { headers: { Authorization: `Bearer ${accessToken}` } });
        }
        catch (e) {
            const detail = e?.response ? `${e.response.status} ${JSON.stringify(e.response.data)}` : e.message;
            throw new Error(`Vidaas signature falhou: ${detail}`);
        }
        const rawSignature = signResp.data.signatures?.[0]?.raw_signature;
        if (!rawSignature)
            throw new Error("Vidaas: resposta de assinatura inválida");
        const signedBuffer = Buffer.from(rawSignature.replace(/\r?\n/g, ""), "base64");
        const certAlias = signResp.data.certificate_alias ?? "";
        return {
            signedBuffer,
            result: { signerName: certAlias || "Certificado ICP-Brasil", signerCpf, signedAt: new Date() },
        };
    }
}
exports.VidaasProvider = VidaasProvider;
