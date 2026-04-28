import { Router } from "express";
import { config } from "dotenv";
import {handleCheckout, handleWebhook} from '../controller/checkoutController.js';

const router = Router();

router.post('/checkout', handleCheckout);
router.post('/webhook/mercadopago', handleWebhook);

export default router;