import dotenv from "dotenv";
dotenv.config();
import pkg from "../generated/client/index.js";
const { PrismaClient } = pkg;
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });

const prisma = new PrismaClient({ adapter });

console.log("Conexión a la base de datos establecida");

export default prisma;