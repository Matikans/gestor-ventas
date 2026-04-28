import prisma from '../utils/prisma.js';

export class StockService {
    static async reduceStock(tenantId, items, tx = prisma) {
        
        for (const item of items) {
            const targetId = item.productId || item.id;
            const combo = await tx.combo.findUnique({ where: { id: targetId}, include: { items: true } });
            if(combo){
                console.log("Es un combo, reduciendo stock de los productos incluidos", { combo: combo.name, items: combo.items });
    
                for (const comboItem of combo.items) {
                    const totalNeeded = comboItem.quantity * item.quantity;
                    
                    await tx.product.update({
                        where: { id: comboItem.productId, stock: {gte: totalNeeded}},
                        data: { stock: { decrement: comboItem.quantity * item.quantity }}
                    });
                
                }
            }else{
                console.log("No es un combo, reduciendo stock del producto", { productId: targetId, quantity: item.quantity });
                await tx.product.update({
                    where: { id: targetId, stock: {gte: item.quantity}},
                    data: { stock: { decrement: item.quantity }}
                });
            }
        }
    }
}