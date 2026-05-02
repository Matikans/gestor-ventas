import prisma from "../utils/prisma.js";
import { getStoreContext, generateAIResponse } from "../services/aiService.js";
import twilio from "twilio";
import { CheckoutService } from "../services/checkoutService.js";
import { getBusinessStatus } from "../services/schedulerService.js";
import { validateAddress } from "../services/locationService.js";

// Helper para responder a Twilio rápido y evitar timeouts
const endTwilioRequest = (res) => res.status(200).send('<Response></Response>');

export const verifyWebhook = (req, res) => {
    res.status(200).send('twilio webhook verified');
}

export const receiveMessage = async (req, res) => {
    try {
        const { Body: messageText, From: customerPhoneRaw, To: twilioNumber } = req.body;
        
        // Corrección 1: Si no hay texto, cerramos la petición correctamente
        if (!messageText) return endTwilioRequest(res); 
        
        const customerPhone = customerPhoneRaw.replace('whatsapp:', '');
        const cleanTwilioNumber = twilioNumber.replace('whatsapp:+', '').trim();
        
        const apiConfig = await prisma.apiConfig.findFirst({ 
            where: { whatsappPhoneId: cleanTwilioNumber || null },
            include: { tenant: true } // Aseguramos traer los datos del tenant
        });
        
        // Corrección 2: Cerrar petición si no es un cliente válido
        if(!apiConfig || !apiConfig.tenant) return endTwilioRequest(res);
        
        const tenantId = apiConfig.tenantId;
        const tenantAddress = apiConfig.tenant.address || "Dirección no disponible";
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, apiConfig.whatsappToken);
        
        const status = await getBusinessStatus(tenantId);
        if(!status.isOpen){
            await client.messages.create({
                body:`¡Hola! 👋 Gracias por escribir a ${apiConfig.tenant.businessName}. En este momento estamos cerrados. ${status.message}.`,
                from: twilioNumber, to: customerPhoneRaw
            });
            // Corrección 3: Avisar a Twilio que ya procesamos este mensaje
            return endTwilioRequest(res);
        }
        
        let session = await prisma.session.upsert({
            where: { customerPhone_tenantId: {customerPhone, tenantId} },
            update: { lastInteraction: new Date() },
            create: { customerPhone, tenantId, currentState: "CHAT" }
        });
        
        let historyArray = [];
        try {
            historyArray = typeof session.chatHistory === 'string' 
                ? JSON.parse(session.chatHistory || "[]") // Si alguna vez se guardó como string
                : (session.chatHistory || []);
        } catch (e) {
            console.error("Error parseando historial:", e);
        }
        
        let finalMessage = "";
        
        // ESTADO: ESPERANDO DIRECCIÓN
        if(session.currentState === "AWAITING_ADDRESS") {
            const addressCheck = await validateAddress(messageText);
            
            if(!addressCheck.isValid) {
                finalMessage = `Ups, no encuentro esa dirección en Córdoba: ${addressCheck.error}. ¿Me la pasás de nuevo?`;
            } else {
                const pendingOrder = session.pendingOrder;
                const checkout = await CheckoutService.createCheckout(tenantId, customerPhone, {
                    ...pendingOrder,
                    deliveryMethod: "DELIVERY"
                });
        
                finalMessage = `¡Excelente! Ubiqué la dirección: ${addressCheck.formattedAddress}.\n\nAquí tenés tu link de pago: ${checkout.paymentLink}`;
                
                await prisma.session.update({
                    where: { customerPhone_tenantId: {customerPhone, tenantId} },
                    data: {
                        deliveryAddress: addressCheck.formattedAddress,
                        currentState: "CHAT",
                        deliveryMethod: "DELIVERY"
                    }
                });
            }
        }
        // ESTADO: CHAT NORMAL
        else {
            const productsContext = await getStoreContext(tenantId);
            const aiReplay = await generateAIResponse(messageText, productsContext, apiConfig.tenant.businessName, tenantAddress, historyArray);
            
            finalMessage = aiReplay.reply || "Disculpame, che, se me trabó la neurona un segundo.";
        
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
        }
        
        // ACTUALIZAR HISTORIAL UNIVERSAL
        try {
            const userMsg = String(messageText || "").trim();
            const aiMsg = String(finalMessage || "").trim();
            const newHistoryStep = [
                ...historyArray, 
                { role: 'user', content: userMsg }, 
                { role: 'assistant', content: aiMsg }
            ].slice(-10); // Mantenemos los últimos 10 mensajes para no reventar el límite de tokens de OpenAI/Gemini
        
            await prisma.session.update({
                where: { customerPhone_tenantId: { customerPhone, tenantId } },
                // Corrección 4: Pasamos el array directamente si el campo es Json
                data: { chatHistory: newHistoryStep } 
            });
        } catch (historyErr) {
            console.error("❌ Error actualizando historial:", historyErr.message);
        }
        
        // ENVIAR MENSAJE FINAL
        await client.messages.create({
            from: twilioNumber,
            to: customerPhoneRaw,
            body: finalMessage,
        });
        
        endTwilioRequest(res);

    } catch (error) {
        console.error("Error en receiveMessage:", error);
        // Evitamos enviar error 500 para que Twilio no reintente enviar el mismo mensaje defectuoso
        endTwilioRequest(res); 
    }
}