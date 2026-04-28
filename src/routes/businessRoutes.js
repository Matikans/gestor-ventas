import { Router } from "express";
import { getBusinessHours, updateBusinessHours, createSpecialDate, getApiConfig, updateApiConfig } from "../controller/businessController.js";
import authenticateToken from "../middlewares/authMiddleware.js";

const router = Router();

router.use(authenticateToken)

router.get('/hours', getBusinessHours);
router.put('/hours', updateBusinessHours);

router.post('/special-date', createSpecialDate);

router.get('/api-config', getApiConfig);
router.put('/api-config', updateApiConfig);

export default router;