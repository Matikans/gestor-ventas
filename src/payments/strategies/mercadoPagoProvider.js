import { MercadoPagoConfig, Preference } from 'mercadopago';
import prisma from '../../utils/prisma.js';
import { StockService } from '../../services/stockService.js';

export class MercadoPagoProvider {
    constructor(accessToken) {
        this.accessToken = accessToken;
        this.client = new MercadoPagoConfig({
            accessToken: this.accessToken,
        });
    }
    async createLink(request) {
        const preference = new Preference(this.client);

        const fee = Number(parseFloat(request.marketplaceFee).toFixed(2))

        const response = await preference.create({
            body: {
                items: request.items.map(items => ({
                    title: items.title,
                    quantity: items.quantity,
                    unit_price: items.unit_price,
                })),
                //marketplace_fee: fee,
                external_reference: request.orderId,
                back_urls: {
                    success: `https://sites.google.com/view/quefantasma/inicio?fbclid=IwY2xjawQ70rBleHRuA2FlbQIxMABicmlkETE0bDNlaGwwWXIzVDNxMWZXc3J0YwZhcHBfaWQPNTE0NzcxNTY5MjI4MDYxAAEezsVT4QjAAHL-usX-ZRVpIIrt1arg39ViBRXYfkSbib0Uf2veandYcDjEuE0_aem_hHUNjL1A9N7A2arPweV1gQ`,
                },
                 metadata: {
                    tenantId: request.tenantId
                },
                auto_return: "approved",
                notification_url: `https://towerless-denna-racemose.ngrok-free.dev/webhook/mercadopago?tenantId=${request.tenantId}`,
                
            }
        })
        return response.init_point;
    }

    async handleWebhook(data) {
        try {
            const topic = data.topic || data.type;
            const paymentId = data.data?.id || data['data.id'] || data.id;

            console.log(`Intentando procesar - Topic: ${topic}, ID detectado: ${paymentId}`)
            
            if (topic === 'payment' && paymentId) {
                console.log("Procesando pago ID: ", paymentId)
                const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                    headers: {
                        Authorization: `Bearer ${this.accessToken}`,
                    },
                });
                const paymentInfo = await response.json();
    
                if (paymentInfo.status === 'approved') {
                    const orderId = paymentInfo.external_reference;
                    console.log("Iniciamos transaccion de pago y stock")
    
                    const order = await prisma.order.findUnique({ where: { id: orderId } });

                    if (!order || order.status !== 'PENDING') {
                        console.log(`⚠️ Webhook ignorado: La orden ${orderId} ya está en estado ${order?.status}`);
                        return;
                    }
    
                    if (order && order.status === 'PENDING') {
                        await prisma.$transaction(async (tx) => {
                            await tx.order.update({
                                where: { id: orderId },
                                data: { status: 'PAID', paymentId: paymentId.toString() },
                            });
                            await StockService.reduceStock(order.tenantId, order.items, tx);
                        });
                        console.log("✅ Stock reducido y orden marcada como paga.");
                    } else {
                        console.log(`⚠️ La orden ${orderId} ya está paga o no existe (Status: ${order?.status}).`);
                    }
                }
                
            }
        }catch(error){
            console.error("Error handling MercadoPago webhook:", error);
        }
    }
}
