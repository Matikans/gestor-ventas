import { MercadoPagoProvider } from "./strategies/mercadoPagoProvider.js";


export class PaymentFactory {
    static create(providerType, token) {
        switch (providerType) {
            case "mercadopago":
                return new MercadoPagoProvider(token);
            default:
                throw new Error("Unsupported payment provider");
        }
    }
}