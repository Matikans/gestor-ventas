import prisma from './src/utils/prisma.js';
import { CheckoutService } from './src/services/checkoutService.js';
import { StockService } from './src/services/stockService.js';

async function testFullFlow() {
    const TEST_PHONE = "5493517707763";
    
    // 1. Buscamos un Tenant y un Producto real
    const tenant = await prisma.tenant.findFirst({ include: { products: true } });
    if (!tenant || tenant.products.length === 0) {
        console.error("❌ Necesitás al menos un Tenant y un Producto en la DB.");
        return;
    }

    const product = tenant.products[0];

    try {
        await prisma.session.upsert({
            where: { customerPhone_tenantId: { customerPhone: TEST_PHONE, tenantId: tenant.id } },
            update: {
                pendingOrder: {
                    items: [{ id: product.id, name: product.name, price: Number(product.price), quantity: 2 }],
                    total: Number(product.price) * 2
                }
            },
            create: { customerPhone: TEST_PHONE, tenantId: tenant.id }
        });

        console.log("🛒 Carrito preparado con 2 unidades.");

        // 3. PASO A: Intentar Checkout (Valida stock internamente)
        console.log("Step 1: Validando stock y generando link...");
        const checkout = await CheckoutService.createCheckout(tenant.id, TEST_PHONE);
        console.log("✅ Link generado con éxito:", checkout.paymentLink);

        // 4. PASO B: Simular que Mercado Pago avisó que se pagó
        console.log("\nStep 2: Simulando notificación de pago aprobada...");
        
        // Ejecutamos la lógica que iría en el Webhook
        await StockService.reduceStock(tenant.id, [{ id: product.id, quantity: 2 }]);
        
        // 5. Verificamos el resultado final
        const updatedProduct = await prisma.product.findUnique({ where: { id: product.id } });
        console.log("--------------------------------------------------");
        console.log(`🔥 RESULTADO FINAL:`);
        console.log(`Stock anterior: ${product.stock}`);
        console.log(`Stock actual:   ${updatedProduct.stock}`);
        console.log("--------------------------------------------------\n");

        if (updatedProduct.stock === product.stock - 2) {
            console.log("✅ ¡TEST EXITOSO! El stock se descontó correctamente.");
        } else {
            console.log("❌ Error: El stock no coincide.");
        }

    } catch (error) {
        console.error("❌ FALLO EN EL TEST:", error.message);
    } finally {
        await prisma.$disconnect();
    }
}

testFullFlow();