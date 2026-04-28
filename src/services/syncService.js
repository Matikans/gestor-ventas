import axios from 'axios';
import { parse } from 'csv-parse/sync';
import prisma from '../utils/prisma.js'; // Tu instancia de Prisma

export const syncProductsFromSheet = async () => {
    const baseCsvUrl = process.env.SHEET_CSV_URL;

    if (!baseCsvUrl) return;

    try {
        // Agregamos un número aleatorio al final de la URL para saltar la caché
        const cacheBuster = `&t=${Date.now()}`;
        const finalUrl = baseCsvUrl + cacheBuster;

        console.log("Consultando versión más reciente del Sheets...");
        const response = await axios.get(finalUrl);
        
        const records = parse(response.data, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            delimiter: [',', ';'] // <--- Agregá esto para que pruebe con ambos
        });
        console.log("Datos obtenidos del Sheets:", records); // <--- AGREGÁ ESTO
        const updates = records.map(row => {
            // Normalizamos el ID para que no importe si escribió "Papas" o "papas"
            const cleanId = row.ID.trim().toLowerCase(); 

            return prisma.product.upsert({
                where: { id: cleanId },
                update: {
                    name: row.Producto,
                    price: parseFloat(row.Precio),
                    stock: parseInt(row.Stock),
                    isActive: row.Activo.toUpperCase() === 'SI'
                },
                create: {
                    id: cleanId,
                    name: row.Producto,
                    price: parseFloat(row.Precio) || 0,
                    stock: parseInt(row.Stock),
                    isActive: row.Activo.toUpperCase() === 'SI',
                    tenantId: "55a829d2-28f4-48f1-949d-6481d47c7053" // Lo hardcodeas para este cliente
                }
            });
        });

        console.log("Registros detectados:", records); // <--- AGREGÁ ESTO
        await prisma.$transaction(updates);
        console.log(`✅ Sincronización exitosa.`);

    } catch (error) {
        console.error("❌ Error:", error.message);
    }
};