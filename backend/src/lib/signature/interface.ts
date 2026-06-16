export interface SignatureInitParams {
  signatureId: string;
  documentHash: string;
  doctorName: string;
  doctorCpf?: string | null;
  frontendUrl: string;
}

export interface SignatureInitResult {
  redirectUrl: string;
}

export interface SignatureCallbackParams {
  oauthState: string;
  code?: string;
  [key: string]: string | undefined;
}

export interface SignatureResult {
  signerName: string;
  signerCpf?: string;
  signedAt: Date;
}

export interface ISignatureProvider {
  name: string;
  init(params: SignatureInitParams): Promise<SignatureInitResult>;
  sign(pdfBuffer: Buffer, params: SignatureCallbackParams): Promise<{ signedBuffer: Buffer; result: SignatureResult }>;
}
