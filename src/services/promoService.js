import prisma from '../utils/prisma.js';

export const createPromo = async (tenantId, data)=>{
    return await prisma.combo.create({
        data:{
            tenantId,
            name: data.name,
            type: data.type,
            discountValue: data.discountValue,
            items: {
                create: data.items.map(i => ({
                    productId: i.productId,
                    quantity: i.quantity,
                }))
            }
        },
        include: {items: {include: {product: true}}
    }
})}

//Nasheee