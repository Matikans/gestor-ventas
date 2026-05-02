import "dotenv/config";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;
const connectionString = `${process.env.DIRECT_URL}?sslmode=require`;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg({pool});

const prisma = new PrismaClient({ adapter });

console.log("Conexión establecida", process.env.DIRECT_URL);

export default prisma;