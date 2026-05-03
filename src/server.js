import 'dotenv/config';
import express from 'express';
import cors from 'cors'
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import promoRoutes from "./routes/promoRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import businessRoutes from "./routes/businessRoutes.js";
import webRoutes from "./routes/webRoutes.js";
import prisma from "./utils/prisma.js";

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }))

app.use('/api/web', webRoutes)
app.use('/products', productRoutes);
app.use('/webhook', webhookRoutes);
app.use('/promos', promoRoutes);
app.use('/', paymentRoutes);
app.use('/auth', authRoutes);
app.use('/api/business', businessRoutes)

const PORT = process.env.PORT || 8000;

// Escuchar señales de apagado
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
app.listen(PORT, () => {
  console.log("Link Data:", process.env.DATABASE_URL);
  console.log(`Estamos escuchando en el puerto ${PORT}`);
});