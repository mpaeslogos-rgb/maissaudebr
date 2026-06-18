import axios from "axios";
import crypto from "crypto";
import type { ISignatureProvider, SignatureInitParams, SignatureInitResult, SignatureCallbackParams } from "./interface";

// Vidaas (Valid Certificadora) — ICP-Brasil cloud certificate
// Docs: https://valid-sa.atlassian.net/wiki/spaces/PDD/pages/958365697
// Env vars needed:
//   VIDAAS_CLIENT_ID
//   VIDAAS_CLIENT_SECRET
//   VIDAAS_BASE_URL  (default: https://certificado.vidaas.com.br)
//   BACKEND_URL      (for OAuth callback)

const VIDAAS_BASE = process.env.VIDAAS_BASE_URL ?? "https://certificado.vidaas.com.br";

export class VidaasProvider implements ISignatureProvider {
  name = "VIDAAS";

  private clientId = process.env.VIDAAS_CLIENT_ID ?? "";
  private clientSecret = process.env.VIDAAS_CLIENT_SECRET ?? "";

  async init(params: SignatureInitParams): Promise<SignatureInitResult> {
    const callbackUrl = `${process.env.BACKEND_URL ?? "http://localhost:3001"}/digital-signature/callback`;
    const state = params.signatureId;

    // Vidaas OAuth2 PKCE flow
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");

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

  async sign(pdfBuffer: Buffer, params: SignatureCallbackParams) {
    const { code, codeVerifier } = params;
    if (!code) throw new Error("Vidaas: authorization code ausente no callback");
    if (!codeVerifier) throw new Error("Vidaas: code_verifier ausente — PKCE comprometido");

    const callbackUrl = `${process.env.BACKEND_URL ?? "http://localhost:3001"}/digital-signature/callback`;

    const tokenResp = await axios.post(
      `${VIDAAS_BASE}/v0/oauth/token`,
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: callbackUrl,
        code_verifier: codeVerifier,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    const sessionToken: string = tokenResp.data.signature_session;

    // Calcula hash SHA-256 do PDF
    const documentHash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

    // Solicita assinatura PAdES (PDF com assinatura embutida)
    const signResp = await axios.post(
      `${VIDAAS_BASE}/v1/signatures`,
      {
        hashes: [
          {
            id: "doc-1",
            alias: "Documento Médico",
            hash: documentHash,
            hash_algorithm: "SHA256",
            signature_format: "PAdES_AD_RB",
          },
        ],
      },
      { headers: { Authorization: `Bearer ${sessionToken}` } }
    );

    const signedBase64: string = signResp.data.signatures?.[0]?.file_base64_encoded;
    if (!signedBase64) throw new Error("Vidaas: resposta de assinatura inválida");

    const signedBuffer = Buffer.from(signedBase64, "base64");
    const signerName: string = signResp.data.signatures?.[0]?.signer_name ?? "Desconhecido";
    const signerCpf: string = signResp.data.signatures?.[0]?.signer_cpf ?? "";

    return {
      signedBuffer,
      result: { signerName, signerCpf, signedAt: new Date() },
    };
  }
}
