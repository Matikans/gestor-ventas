import registerService from '../services/authService.js';
import { Router } from 'express';

const routes = new Router();

routes.get('/register',(req, res) => {
    res.json({ message: "Register endpoint is working" });
});
routes.post('/register', registerService.register);
routes.post('/login', registerService.login);


export default routes;