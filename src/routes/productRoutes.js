import { Router } from 'express';
import { createProduct, getProducts, updateProduct, deleteProduct } from '../controller/productController.js';
import autenticateToken from '../middlewares/authMiddleware.js';

const routes = new Router();

routes.post('/', autenticateToken, createProduct);
routes.get('/', autenticateToken, getProducts);
routes.put('/:id', autenticateToken, updateProduct);
routes.delete('/:id', autenticateToken, deleteProduct);

export default routes;