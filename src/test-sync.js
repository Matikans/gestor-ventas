// test-sync.js
import { syncProductsFromSheet } from './services/syncService.js';
import 'dotenv/config'; // Para que lea tu SHEET_CSV_URL del .env

async function runTest() {
    console.log("--- INICIANDO TEST DE SINCRONIZACIÓN ---");
    await syncProductsFromSheet();
    console.log("--- TEST FINALIZADO ---");
    process.exit();
}

runTest();