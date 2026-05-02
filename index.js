import dotenv from "dotenv";
dotenv.config();
import{ PrismaClient} from  "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const adapter = new PrismaPg({
    connectionString: process.env.DIRECT_URL,
});

const prisma = new PrismaClient({
    adapter,
});

export default prisma;