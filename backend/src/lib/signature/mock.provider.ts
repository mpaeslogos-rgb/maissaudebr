import crypto from "crypto";
import type { ISignatureProvider, SignatureInitParams, SignatureInitResult, SignatureCallbackParams } from "./interface";

export class MockSignatureProvider implements ISignatureProvider {
  name = "MOCK";

  async init(params: SignatureInitParams): Promise<SignatureInitResult> {
    const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3001";
    const redirectUrl = `${backendUrl}/digital-signature/mock-sign/${params.signatureId}?frontendUrl=${encodeURIComponent(params.frontendUrl)}`;
    return { redirectUrl };
  }

  async sign(pdfBuffer: Buffer, _params: SignatureCallbackParams) {
    return {
      signedBuffer: pdfBuffer,
      result: {
        signerName: "Médico Sandbox (Mock)",
        signerCpf: "000.000.000-00",
        signedAt: new Date(),
      },
    };
  }
}
