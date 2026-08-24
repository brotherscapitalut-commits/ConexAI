#!/usr/bin/env node
/**
 * Insere 5 transações fictícias em platform_finances (taxas R$ 50 cada) para o dashboard de finanças mostrar dados.
 * Uso: node scripts/seedPlatformFinances.js
 */

import pg from "pg";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

const connectionString =
  process.env.DATABASE_URL || "postgresql://postgres:123456@localhost:5432/muraldigital";

async function main() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    const fee = 50;
    for (let i = 0; i < 5; i++) {
      await client.query(
        `INSERT INTO public.platform_finances (transaction_type, amount, fee_collected, status, created_at)
         VALUES ($1, $2, $3, 'completed', now())`,
        ["taxa_plataforma", fee * 2, fee]
      );
    }
    console.log("5 transações de taxa (R$ 50 cada) inseridas em platform_finances. Profit Total deve mostrar R$ 250,00.");
  } catch (err) {
    console.error("Erro:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
