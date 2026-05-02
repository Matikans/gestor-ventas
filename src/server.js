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
app.listen(PORT, () => {
  console.log("Link Data:", process.env.DIRECT_URL);
  console.log(`Estamos escuchando en el puerto ${PORT}`);
});