"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockSignatureProvider = void 0;
class MockSignatureProvider {
    name = "MOCK";
    async init(params) {
        const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3001";
        const redirectUrl = `${backendUrl}/digital-signature/mock-sign/${params.signatureId}?frontendUrl=${encodeURIComponent(params.frontendUrl)}`;
        return { redirectUrl };
    }
    async sign(pdfBuffer, _params) {
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
exports.MockSignatureProvider = MockSignatureProvider;
