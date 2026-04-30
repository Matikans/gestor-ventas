import {verifyWebhook, receiveMessage} from "../controller/webhookController.js";
import { Router } from 'express';

const routes = new Router();

routes.get('/', verifyWebhook);
routes.post('/', receiveMessage);
export default routes;