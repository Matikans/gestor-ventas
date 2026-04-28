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
            // FLUJO NORMAL CON IA
            const historyArray = typeof session.chatHistory === 'string' 
                ? JSON.parse(session.chatHistory || "[]") 
                : (session.chatHistory || []);
            const productsContext = await getStoreContext(tenantId);
            const aiReplay = await generateAIResponse(messageText, productsContext, apiConfig.tenant.businessName,tenantAddress, historyArray);
            console.log(aiReplay)

            finalMessage = aiReplay.reply || "Disculpame, che, se me trabó la neurona un segundo.";

            if(aiReplay.intent === 'PURCHASE') {
                const { items, total } = await CheckoutService.prepareOrderFromAI(tenantId, aiReplay.items);
                const pendingOrderData = { items, total, status: "AWAITING_PAYMENT" };

                if(aiReplay.deliveryMethod === 'DELIVERY') {
                    console.log("Intentando guardar historial para:", customerPhone);
                    await prisma.session.update({
                        where: { customerPhone_tenantId: {customerPhone, tenantId} },
                        data: {
                            currentState: "AWAITING_ADDRESS",
                            pendingOrder: pendingOrderData,
                            deliveryMethod: "DELIVERY"
                        }
                    });
                    finalMessage = "¡Genial! Pasame tu dirección exacta (Calle y altura) en Córdoba Capital para calcular el envío.";
                } else if (aiReplay.deliveryMethod === 'PICKUP') {
                    const checkout = await CheckoutService.createCheckout(tenantId, customerPhone, {
                        ...pendingOrderData,
                        deliveryMethod: "PICKUP"
                    });
                    finalMessage += `\n\nAquí tienes tu link de pago para retirar en el local: ${checkout.paymentLink}`;
                    // Volvemos a CHAT porque ya generamos el link
                    await prisma.session.update({
                        where: { customerPhone_tenantId: {customerPhone, tenantId} },
                        data: { currentState: "CHAT", deliveryMethod: "PICKUP" }
                    });
                }
            }

            // 3. GUARDAR TODO EN EL HISTORIAL (Aplica para CHAT y PURCHASE)
            const newHistoryStep = [
                ...historyArray, 
                { role: 'user', content: messageText }, 
                { role: 'model', content: finalMessage }
            ];
            console.log("Intentando guardar historial para:", customerPhone);
            await prisma.session.update({
                where: { customerPhone_tenantId: {customerPhone, tenantId} },
                data: { chatHistory: JSON.stringify(newHistoryStep.slice(-10)) }
            });
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