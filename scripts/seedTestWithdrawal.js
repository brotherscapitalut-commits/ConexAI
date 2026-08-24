#!/usr/bin/env node
/**
 * Insere uma solicitação de saque de teste (pending) para /admin/finance.
 * Uso: node scripts/seedTestWithdrawal.js
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
    const { rows } = await client.query("SELECT id FROM public.profiles LIMIT 1");
    if (rows.length === 0) {
      console.log("Nenhum perfil em profiles. Crie um usuário primeiro (cadastro).");
      process.exit(1);
    }
    const userId = rows[0].id;
    await client.query(
      "INSERT INTO public.withdrawal_requests (user_id, amount, status, created_at) VALUES ($1, $2, 'pending', now())",
      [userId, 150.0]
    );
    console.log("Solicitação de saque de teste criada: R$ 150,00 (pending). Teste em /admin/finance.");
  } catch (err) {
    console.error("Erro:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
