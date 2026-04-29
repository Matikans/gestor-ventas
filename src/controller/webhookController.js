import prisma from "../utils/prisma.js";
import { getStoreContext, generateAIResponse } from "../services/aiService.js";
import twilio from "twilio";
import { CheckoutService } from "../services/checkoutService.js";
import { getBusinessStatus } from "../services/schedulerService.js";
import { validateAddress } from "../services/locationService.js";

export const verifyWebhook = (req, res) => {
    res.status(200).send('twilio webhook verified');
}

export const resiveMessage = async(req, res) => {
    res.status(200).send('<Response></Response>');
    try {
        const {Body: messageText, From:customerPhoneRaw, To:twilioNumber} = req.body;
        if (!messageText) return;

        const customerPhone = customerPhoneRaw.replace('whatsapp:', '');
        const cleanTwilioNumber = twilioNumber.replace('whatsapp:', '').replace('+', '').trim();
        console.log(customerPhone)

        const apiConfig = await prisma.apiConfig.findFirst({
            where: {whatsappPhoneId: cleanTwilioNumber},
            include: {tenant: true}
        });

        if(!apiConfig || !apiConfig.tenant) return;
        const tenantId = apiConfig.tenantId;
        const tenantAddress = apiConfig.tenant.address || "Direccion no disponible";
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, apiConfig.whatsappToken);

        const status = await getBusinessStatus(tenantId);
        if(!status.isOpen){
            await client.messages.create({
                body:`¡Hola! 👋 Gracias por escribir a ${apiConfig.tenant.businessName}. En este momento estamos cerrados. ${status.message}.`,
                from:`whatsapp:${cleanTwilioNumber}`, to:`whatsapp:${customerPhone}`
            });
            return;
        }
       
        // 1. Buscamos o creamos la sesión (upsert nos devuelve el objeto actualizado)
        let session = await prisma.session.upsert({
            where: { customerPhone_tenantId: {customerPhone, tenantId} },
            update: { lastInteraction: new Date() },
            create: { customerPhone, tenantId, currentState: "CHAT" }
        });
        let finalMessage = "";
        // 2. LÓGICA DE ESTADOS
        if(session.currentState === "AWAITING_ADDRESS") {
            const addressCheck = await validateAddress(messageText);
            if(!addressCheck.isValid) {
                finalMessage = `Ups, no encuentro esa dirección en Córdoba: ${addressCheck.error}. ¿Me la pasás de nuevo?`;
            } else {
                session = await prisma.session.update({
                    where: { customerPhone_tenantId: {customerPhone, tenantId} },
                    data: {
                        deliveryAddress: addressCheck.formattedAddress,
                        currentState: "CHAT"
                    }
                });

                const pendingOrder = session.pendingOrder;
                const checkout = await CheckoutService.createCheckout(tenantId, customerPhone, {
                    ...pendingOrder,
                    deliveryMethod: "DELIVERY"
                });
                finalMessage = `¡Excelente! Ubiqué la dirección: ${addressCheck.formattedAddress}.\n\nAquí tenés tu link de pago (incluye envío): ${checkout.paymentLink}`;
                await prisma.session.update({
                    where: { customerPhone_tenantId: {customerPhone, tenantId} },
                    data: {
                        currentState: "CHAT",
                        deliveryMethod: "DELIVERY"
                    }
                });
            }
        }
else {
            // 1. LEER HISTORIAL (Aseguramos que sea un array)
            let historyArray = [];
            try {
                historyArray = typeof session.chatHistory === 'string' 
                    ? JSON.parse(session.chatHistory || "[]") 
                    : (session.chatHistory || []);
            } catch (e) {
                console.error("Error parseando historial previo:", e);
                historyArray = [];
            }

            const productsContext = await getStoreContext(tenantId);
            const aiReplay = await generateAIResponse(messageText, productsContext, apiConfig.tenant.businessName, tenantAddress, historyArray);
            
            // LOG DE CONTROL
            console.log("IA REPLY OBJECT:", JSON.stringify(aiReplay));

            finalMessage = aiReplay.reply || "Disculpame, che, se me trabó la neurona un segundo.";

            console.log("--- DEBUG HISTORIAL ---");
            console.log("1. Intentando guardar para:", customerPhone);
            console.log("2. TenantId:", tenantId);

            // 2. LÓGICA DE COMPRA
            if(aiReplay.intent === 'PURCHASE' && aiReplay.items?.length > 0) {
                try {
                    const { items, total } = await CheckoutService.prepareOrderFromAI(tenantId, aiReplay.items);
                    const pendingOrderData = { items, total, status: "AWAITING_PAYMENT" };

                    if(aiReplay.deliveryMethod === 'DELIVERY') {
                        await prisma.session.update({
                            where: { customerPhone_tenantId: {customerPhone, tenantId} },
                            data: {
                                currentState: "AWAITING_ADDRESS",
                                pendingOrder: pendingOrderData,
                                deliveryMethod: "DELIVERY"
                            }
                        });
                        finalMessage = "¡Genial! Pasame tu dirección exacta (Calle y altura) en Córdoba Capital para calcular el envío.";
                    } else {
                        const checkout = await CheckoutService.createCheckout(tenantId, customerPhone, {
                            ...pendingOrderData,
                            deliveryMethod: "PICKUP"
                        });
                        finalMessage += `\n\nAquí tienes tu link de pago: ${checkout.paymentLink}`;
                        await prisma.session.update({
                            where: { customerPhone_tenantId: {customerPhone, tenantId} },
                            data: { currentState: "CHAT", deliveryMethod: "PICKUP" }
                        });
                    }
                } catch (purchaseError) {
                    console.error("❌ Error en flujo PURCHASE:", purchaseError.message);
                }
            }

            // 3. ACTUALIZAR HISTORIAL (FORZADO)
            try {
                const newHistoryStep = [
                    ...historyArray, 
                    { role: 'user', content: String(messageText) }, 
                    { role: 'model', content: String(finalMessage) }
                ];

                const updated = await prisma.session.update({
                    where: { 
                        customerPhone_tenantId: { 
                            customerPhone: String(customerPhone), 
                            tenantId: String(tenantId) 
                        } 
                    },
                    data: { 
                        chatHistory: JSON.stringify(newHistoryStep.slice(-10)) 
                    }
                });

                if (updated) {
                    console.log("✅ DB UPDATE SUCCESS para:", customerPhone);
                }
            } catch (historyErr) {
                console.error("❌ DB UPDATE FAIL:", historyErr.message);
                // Si falla acá, imprimí el objeto que falló para ver si es un tema de tipos
                console.error("Data intentada:", { customerPhone, tenantId });
            }
        }
        // 3. ENVIAR MENSAJE FINAL
        await client.messages.create({
            from:`whatsapp:${cleanTwilioNumber}`,
            to:`whatsapp:${customerPhone}`,
            body: finalMessage,
        });
    } catch(error) {
        console.error('Error en el Webhook:', error.message);
    }

}