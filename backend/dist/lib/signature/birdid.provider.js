"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BirDIProvider = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
// BirDI (Soluti / VaultID) — ICP-Brasil cloud certificate
// Docs: https://docs.vaultid.com.br/workspace/cess/api
// Env vars needed:
//   BIRDID_CLIENT_ID
//   BIRDID_CLIENT_SECRET
//   BIRDID_BASE_URL  (default: https://apiv2.birdid.com.br)
//   BACKEND_URL      (for OAuth callback)
const BIRDID_BASE = process.env.BIRDID_BASE_URL ?? "https://apiv2.birdid.com.br";
class BirDIProvider {
    name = "BIRDID";
    clientId = process.env.BIRDID_CLIENT_ID ?? "";
    clientSecret = process.env.BIRDID_CLIENT_SECRET ?? "";
    async init(params) {
        const callbackUrl = `${process.env.BACKEND_URL ?? "http://localhost:3001"}/digital-signature/callback`;
        const state = params.signatureId;
        const url = new URL(`${BIRDID_BASE}/v2/oauth/authorize`);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("client_id", this.clientId);
        url.searchParams.set("redirect_uri", callbackUrl);
        url.searchParams.set("scope", "single_signature");
        url.searchParams.set("state", state);
        return { redirectUrl: url.toString() };
    }
    async sign(pdfBuffer, params) {
        const { code } = params;
        if (!code)
            throw new Error("BirDI: authorization code ausente no callback");
        // Troca code por access_token
        const tokenResp = await axios_1.default.post(`${BIRDID_BASE}/v2/oauth/token`, new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: `${process.env.BACKEND_URL ?? "http://localhost:3001"}/digital-signature/callback`,
            client_id: this.clientId,
            client_secret: this.clientSecret,
        }), { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
        const accessToken = tokenResp.data.access_token;
        // Calcula hash SHA-256 do PDF
        const documentHash = crypto_1.default.createHash("sha256").update(pdfBuffer).digest("hex");
        // Solicita assinatura PAdES via BirDI CESS API
        const signResp = await axios_1.default.post(`${BIRDID_BASE}/v2/sign`, {
            hashes: [{ id: "doc-1", alias: "Documento Médico", hash: documentHash, hash_algorithm: "SHA256" }],
            signature_format: "CAdES_AD_RB",
            pdf_signature: {
                location: "Brasil",
                reason: "Assinatura Digital Médica",
                contact: "",
            },
        }, { headers: { Authorization: `Bearer ${accessToken}` } });
        const signedBase64 = signResp.data.signatures?.[0]?.signed_file ?? "";
        if (!signedBase64)
            throw new Error("BirDI: resposta de assinatura inválida");
        const signedBuffer = Buffer.from(signedBase64, "base64");
        const signerName = signResp.data.signer?.name ?? "Desconhecido";
        const signerCpf = signResp.data.signer?.cpf ?? "";
        return {
            signedBuffer,
            result: { signerName, signerCpf, signedAt: new Date() },
        };
    }
}
exports.BirDIProvider = BirDIProvider;
