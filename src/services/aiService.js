import prisma from "../utils/prisma.js";

import { GoogleGenerativeAI } from "@google/generative-ai";


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({model: "gemini-flash-latest", generationConfig: { responseMimeType: "application/json" }});


export const getStoreContext = async (tenantId) =>{

    const products = await prisma.product.findMany({
        where: {tenantId, isActive: true }
    });
    const promos = await prisma.combo.findMany({
        where: {tenantId, isActive: true },
        include: { items: { include: { product: true } } }
    });


    const productList = products.map(p =>

        `- ${p.name} (ID: ${p.id}): $${p.price} (${p.description || 'Sin descripción'})`

    ).join('\n');


    const promoList = promos.map(p =>
        `- COMBO ${p.name} (ID: ${p.id}): $${p.discountValue} ${p.items?.map((item) => item.product.name).join(', ') || ''} (¡Oferta especial!)`
    ).join('\n');

    return `ESTE ES EL MENÚ COMPLETO:

   

PRODUCTOS:

${productList}


PROMOCIONES Y COMBOS VIGENTES:

${promoList}`;

}



export const generateAIResponse = async (userMessage, productsContext, businessName, tenantAddress, history = []) => {
    let historyArray = [];
    try {
        if (typeof history === 'string') {
            historyArray = JSON.parse(history || "[]");
        } else if (Array.isArray(history)) {
            historyArray = history;
        }
    } catch (error) {
        console.error('Error parsing history:', error);
    }

    const cleanHistory = [];
    historyArray.forEach((h) => {
        const role = h.role === 'user' ? 'user' : 'model';
        if (cleanHistory.length === 0 && role !== 'user') return;
        if (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === role) {
            cleanHistory[cleanHistory.length - 1].parts[0].text += ` ${h.content || ""}`;
            return;
        }
        cleanHistory.push({
            role: role,
            parts: [{ text: String(h.content || h.parts?.[0]?.text || "") }]
        });

    });

    const prompt = `Eres el asistente virtual de "${businessName}". Tu objetivo es vender y asistir al cliente con excelente predisposición.
        Hablas como un cordobés educado (podés usar un "che" o un "¡hola! ¿cómo andamos?", pero manteniendo el profesionalismo).

        UBICACIÓN DEL LOCAL: ${tenantAddress}


        ESTA ES TU LISTA DE PRODUCTOS Y PRECIOS:
        ${productsContext}

        TAREA:
        Analiza el ÚLTIMO mensaje del cliente y responde ÚNICAMENTE con un objeto JSON válido.
        FORMATO JSON QUE DEBES PASAR(usa los MISMOS nombres que estan entre ""):
        {
        "intent": "CHAT" o "PURCHASE"(Aqui debe ser EXACTAMENTE 1 de estos),
        "reply": "Tu respuesta al cliente aquí"(OBLIGATORIO),
        "items": [{"id": "UUID_EXACTO_ENTRE_PARENTESIS", "quantity": 1}],
        "deliveryMethod": "PICKUP", "DELIVERY" o null
        }
        REGLAS ESTRICTAS:
        1.Responde UNICAMENTE con objetos JSON.
        2. NUNCA inventes productos, precios ni información que no esté en el catálogo. Si no está, decí que no hay por ahora.
        3. Mantén las respuestas cortas, directas y amigables para WhatsApp (máximo 3 párrafos cortos).
        4. Si el cliente solo está charlando, preguntando precios o armando el pedido, el intent DEBE SER "CHAT".
        5. Si el cliente quiere comprar, PREGUNTA el método de entrega (PICKUP o DELIVERY).
        6. NO uses el intent "PURCHASE" hasta que el cliente te haya confirmado exactamente QUÉ quiere y CÓMO lo va a recibir.
        7. NO GENERES LINKS DE PAGO ni inventes URLs. El sistema lo hará solo si devuelves "PURCHASE".
        8. Si ya hubo interacción previa (ver historial), no saludes de nuevo, ve directo al grano.
        9. Si el cliente pregunta por un combo, detalla qué productos lo integran según el catálogo.
        10. Si el cliente quiere comprar o pide el link (aunque escriba con errores), prepárate para usar "PURCHASE" solo cuando tengas el método de entrega.
        11. En el campo "items", debes devolver un arreglo con los productos solo cuando el intent sea "PURCHASE" o si el cliente pregunta cuánto sería el total de lo que va pidiendo
        12. NUNCA ofrecer la opcion de PICKUP si no hay direccion(es null o undefined), metodo directamente será DELIVERY.
        13. Si el cliente elige retirar en el local (PICKUP), confírmale la dirección: ${tenantAddress}.`;


try {
        const chat = model.startChat({
            history: cleanHistory,
        });

        const result = await chat.sendMessage(prompt + `\n\nMensaje del usuario: ${userMessage}`);
        const text = result.response.text();
        
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        
        if (start === -1 || end === -1) {
            throw new Error("La IA no devolvió un JSON válido");
        }

        const jsonString = text.substring(start, end + 1);
        return JSON.parse(jsonString);
    } catch (error) {
        console.error('Error parseando JSON de IA:', error);
        return { intent: 'CHAT', reply: "Disculpame, che, se me hizo un lío. ¿Me repetís?" };
    }

}