import { Router } from "express";
import { createPromo } from "../services/promoService.js";

const router = Router();

router.post('/:tenantId', async (req, res) => {
    try{
        const tenantId = req.params.tenantId;
        const promoData = req.body;
        const newPromo = await createPromo(tenantId, promoData);
        res.status(201).json({
            success: true,
            data: newPromo,
            message: 'Promo created successfully',
        });
    }catch(error){
        console.error('Error creating promo:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;