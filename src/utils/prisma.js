import dotenv from "dotenv";
dotenv.config();
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/*const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
});*/

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});

console.log("Conexión a la base de datos establecida");

export default prisma;