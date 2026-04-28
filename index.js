import dotenv from "dotenv";
dotenv.config();
import{ PrismaClient} from  "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
    adapter,
});

main();

async function main() {
    // Aquí puedes agregar código para probar tu conexión a la base de datos o realizar operaciones CRUD.
    prisma.tenant.findMany().then(tenants => {
        console.log("Tenants:", tenants);
    }).catch(error => {
        console.error("Error fetching tenants:", error);
    });
}