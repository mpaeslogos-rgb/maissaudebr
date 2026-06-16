"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockSignatureProvider = void 0;
const crypto_1 = __importDefault(require("crypto"));
class MockSignatureProvider {
    name = "MOCK";
    async init(params) {
        const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3001";
        const redirectUrl = `${backendUrl}/digital-signature/mock-sign/${params.signatureId}?frontendUrl=${encodeURIComponent(params.frontendUrl)}`;
        return { redirectUrl };
    }
    async sign(pdfBuffer, _params) {
        // Simula assinatura: appenda um bloco de texto de "assinatura" ao buffer
        const mockSig = Buffer.from(`\n%% MOCK DIGITAL SIGNATURE %%\n` +
            `Provider: Mock (Sandbox)\n` +
            `Hash: ${crypto_1.default.createHash("sha256").update(pdfBuffer).digest("hex")}\n` +
            `Signed at: ${new Date().toISOString()}\n` +
            `%% END MOCK SIGNATURE %%\n`);
        const signedBuffer = Buffer.concat([pdfBuffer, mockSig]);
        return {
            signedBuffer,
            result: {
                signerName: "Médico Sandbox",
                signerCpf: "000.000.000-00",
                signedAt: new Date(),
            },
        };
    }
}
exports.MockSignatureProvider = MockSignatureProvider;
