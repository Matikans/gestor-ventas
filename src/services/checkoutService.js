import prisma from '../utils/prisma.js';
import { PaymentFactory } from '../payments/paymentFactory.js'
import Marketplace from 'twilio/lib/rest/Marketplace.js';

export class CheckoutService {

    static async prepareOrderFromAI(tenantId, aiItems){
        const validatedItems = [];
        let total = 0;

        console.log("Vamo a ve:", tenantId);
        for (const item of aiItems) {
            let dbItem = await prisma.product.findUnique({ where: { id: item.id, tenantId } });
            if (!dbItem) {
                dbItem = await prisma.combo.findUnique({ where: { id: item.id, tenantId } });

            }

            if(!dbItem) throw new Error(`Product or combo not found: ${item.id}`);

            const price = Number(dbItem.price || dbItem.discountValue || 0);
            const quantity = Number(item.quantity) || 1;

            validatedItems.push({
                id: dbItem.id,
                name: dbItem.name,
                quantity: quantity,
                unit_price: price,

            })

            total += price * quantity;
        }

        await this.checkStock(tenantId, validatedItems)

        return {items: validatedItems, total}
    }
    static async checkStock(tenantId, cartItems) {
        for (const item of cartItems) {
            const combo = await prisma.combo.findUnique({ where: {id_tenantId: { id: item.id, tenantId }}, include: { items: { include: { product: true } } } });
            if(combo){
                for (const comboItem of combo.items) {
                    const totalNeeded = comboItem.quantity * item.quantity;
                    if (comboItem.product.stock < totalNeeded) {
                        throw new Error(`Not enough stock for product ${comboItem.product.name} in combo ${combo.name}`);
                    }
                }
            }else {
                const product = await prisma.product.findUnique({ where: { tenantId, id: item.id }});
                if (!product || product.stock < item.quantity) {
                    throw new Error(`Not enough stock for product ${product ? product.name : item.id}`);
                }
            }
        }
        return true;
    }

    static async createCheckout(tenantId, customerPhone, pendingOrder){
        const cart = pendingOrder;
        if(!cart || !cart.items){
            throw new Error("No pending order data provided");
        }
        if(!cart.items || cart.items.length === 0) throw new Error("Cart is empty");
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        const config = await prisma.apiConfig.findUnique({where: { tenantId }, include: {tenant: true }});
        console.log(cart)
        
        if (!config?.paymentPrivateKey) throw new Error("Payment provider not configured for this tenant");
        
        const deliveryFee = Number(tenant.deliveryPrice) || 0;
            
        const sanitizedItems = cart.items.map(item => ({
                title: item.name || "Product",
                quantity: Number(item.quantity),
                unit_price: Number(item.unit_price),
                currency_id: "ARS"
            }));
            
        let extraCharge = 0

        if(cart.deliveryMethod === "DELIVERY" && deliveryFee > 0) {
            sanitizedItems.push({
                title: "Envío",
                unit_price: deliveryFee,
                quantity: 1,
                currency_id: "ARS"
            })
            extraCharge = deliveryFee;
        }
        
        const subtotal = parseFloat(cart.total);
        const total = subtotal + extraCharge;
        const percent = Number(config.tenant.commissionPorcent || 1);
        const commission = (subtotal * percent) / 100;

        const order = await prisma.order.create({
            data: {
                tenant: { connect: { id: tenantId } },
                customerPhone: customerPhone,
                totalAmount: total,
                commissionAmount: commission,
                items: cart.items,
                deliveryMethod: cart.deliveryMethod,
                deliveryAddress: cart.deliveryAddress || "",
                paymentProvider: "mercadopago",
                status: "PENDING"
            }
        })

        const paymentProvider = PaymentFactory.create("mercadopago", config.paymentPrivateKey);

        const paymentLink = await paymentProvider.createLink({
            orderId: order.id,
            items: sanitizedItems,
            tenantId: tenantId,
            tenantName: config.tenant.businessName,
            marketplaceFee: commission
        })

        await prisma.session.update({
            where: { customerPhone_tenantId: { customerPhone, tenantId } },
            data: { pendingOrder: {} },
        });

        return {paymentLink, orderId: order.id};
    }
}