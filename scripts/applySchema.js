#!/usr/bin/env node
/**
 * Limpa todas as tabelas e aplica rebuild_supabase_schema.sql no PostgreSQL local.
 * Uso: node scripts/applySchema.js
 * Requer: DATABASE_URL no .env ou variável de ambiente.
 */

import pg from "pg";
import { config } from "dotenv";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
config({ path: join(root, ".env") });

const connectionString =
  process.env.DATABASE_URL || "postgresql://postgres:123456@localhost:5432/muraldigital";

async function main() {
  const dropPath = join(__dirname, "dropAllTables.sql");
  const schemaPath = join(root, "rebuild_supabase_schema.sql");
  const adminSuitePath = join(__dirname, "admin_suite_tables.sql");
  let dropSql, schemaSql, adminSuiteSql;
  try {
    dropSql = readFileSync(dropPath, "utf8");
    schemaSql = readFileSync(schemaPath, "utf8");
    adminSuiteSql = readFileSync(adminSuitePath, "utf8");
  } catch (err) {
    console.error("Erro ao ler arquivos SQL:", err.message);
    process.exit(1);
  }

  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log("Conectado ao PostgreSQL.");

    console.log("Removendo tabelas e tipos antigos...");
    await client.query(dropSql);
    console.log("Tabelas removidas.");

    console.log("Aplicando schema (rebuild_supabase_schema.sql)...");
    await client.query(schemaSql);
    console.log("Aplicando admin_suite_tables.sql (platform_finances, system_health_logs, ai_matchmaking_history)...");
    await client.query(adminSuiteSql);
    console.log("Schema aplicado com sucesso. Banco pronto para login e cadastro.");
  } catch (err) {
    console.error("Erro:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
