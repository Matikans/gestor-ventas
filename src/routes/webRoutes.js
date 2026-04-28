import { Router } from "express";
import prisma from "../utils/prisma.js";


const router = Router();

// Ruta para ver pedidos (la que usaremos en la tabla)
router.get('/orders/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    // Agregá un timeout para que Prisma no se cuelgue infinito
    const orders = await prisma.order.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(orders); // Asegurate del 'return'
  } catch (error) {
    console.error(error);
    return res.status(500).json([]); // Siempre respondé algo, aunque sea vacío
  }
});

export default router;