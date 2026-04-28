import prisma from "../utils/prisma.js";

export const createProduct = async (req, res) => {
    try {
        const { name, description, price, stock } = req.body;
        const {tenantId} = req.user;

        const newProduct = await prisma.product.create({
            data: {
                name,
                description,
                price: parseFloat(price),
                stock: parseInt(stock),
                tenantId,
            },
        }
        );
        res.status(201).json(newProduct);
    }catch (error) {
        res.status(500).json({ error: 'Error creating product' });
    }
}

export const getProducts = async (req, res) => {
    try {
        const {tenantId} = req.user;
        const products = await prisma.product.findMany({
            where: {
                tenantId,
            },
        });
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching products' });
    }
}

export const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, price, stock } = req.body;
        const {tenantId} = req.user;

        const updatedProduct = await prisma.product.update({
            where: {
                id,
                tenantId,
            },
            data: {
                name,
                description,
                price: parseFloat(price),
                stock: parseInt(stock),
            },
        });
        res.status(200).json(updatedProduct);
    } catch (error) {
        res.status(500).json({ error: 'Error updating product' });
    }
}

export const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const {tenantId} = req.user;
        await prisma.product.delete({
            where: {
                id,
                tenantId,
            },
        });
        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting product' });
    }
}