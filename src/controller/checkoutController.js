import { CheckoutService } from '../services/checkoutService.js';
import prisma from '../utils/prisma.js';
import { PaymentFactory } from '../payments/paymentFactory.js';

export const handleCheckout = async (req, res) => {
    try{
        const { tenantId, customerPhone } = req.body;
        console.log("Checkout request received with tenantId:", tenantId, "and customerPhone:", customerPhone);

        if (!tenantId || !customerPhone) {
            return res.status(400).json({ error: 'tenantId and customerPhone are required' });
        }

        const result = await CheckoutService.createCheckout(tenantId, customerPhone);

        return res.status(200).json({
            success: true,
            paymentLink: result.paymentLink,
            orderId: result.orderId
        });
    }catch(error){
        console.error('Error in checkout:', error.message);
        return res.status(500).json({ error: 'Internal server error' });
    }

}

export const handleWebhook = async (req, res) => {
    try {
        const { tenantId } = req.query;
        const webhookData = req.body || {};
        console.log(`Webhook recibido para el tenant: ${tenantId}`);

        const id = webhookData.data?.id || webhookData.id || webhookData.resource?.split('/').pop();
        const type = webhookData.type || webhookData.topic;
        
        if (!tenantId) {
            console.error("❌ Error: No se recibió tenantId en la query string");
            return res.status(400).json({ error: 'tenantId is required in query' });
        }

        const config = await prisma.apiConfig.findUnique({ where: { tenantId } });

        if (!config || !config.paymentPrivateKey) {
            console.error(`❌ No se encontró configuración de pago para el tenant: ${tenantId}`);
            return res.status(404).json({ error: 'Config not found' });
        }

        // Usamos la Factory para obtener el proveedor configurado
        const mpProvider = PaymentFactory.create("mercadopago", config.paymentPrivateKey);

        // El provider se encarga de todo: Fetch, validación de estado y descuento de stock
        await mpProvider.handleWebhook(webhookData);

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('❌ Error procesando webhook:', error.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
