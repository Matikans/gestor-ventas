import {verifyWebhook, resiveMessage} from "../controller/webhookController.js";
import { Router } from 'express';

const routes = new Router();

routes.get('/', verifyWebhook);
routes.post('/', resiveMessage);
export default routes;