import type { ISignatureProvider } from "./interface";
import { MockSignatureProvider } from "./mock.provider";
import { VidaasProvider } from "./vidaas.provider";
import { BirDIProvider } from "./birdid.provider";

export type ProviderName = "MOCK" | "VIDAAS" | "BIRDID";

export function getSignatureProvider(name: ProviderName = "MOCK"): ISignatureProvider {
  switch (name) {
    case "VIDAAS":
      return new VidaasProvider();
    case "BIRDID":
      return new BirDIProvider();
    default:
      return new MockSignatureProvider();
  }
}

export function defaultProvider(): ProviderName {
  const env = process.env.SIGNATURE_PROVIDER?.toUpperCase();
  if (env === "VIDAAS" || env === "BIRDID") return env;
  return "MOCK";
}
