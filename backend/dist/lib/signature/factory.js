"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSignatureProvider = getSignatureProvider;
exports.defaultProvider = defaultProvider;
const mock_provider_1 = require("./mock.provider");
const vidaas_provider_1 = require("./vidaas.provider");
const birdid_provider_1 = require("./birdid.provider");
function getSignatureProvider(name = "MOCK") {
    switch (name) {
        case "VIDAAS":
            return new vidaas_provider_1.VidaasProvider();
        case "BIRDID":
            return new birdid_provider_1.BirDIProvider();
        default:
            return new mock_provider_1.MockSignatureProvider();
    }
}
function defaultProvider() {
    const env = process.env.SIGNATURE_PROVIDER?.toUpperCase();
    if (env === "VIDAAS" || env === "BIRDID")
        return env;
    return "MOCK";
}
