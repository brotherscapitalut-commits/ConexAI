#!/usr/bin/env node
/**
 * Aplica apenas admin_suite_tables.sql (sem dropar o banco).
 * Uso: node scripts/applyAdminSuite.js
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
  const sqlPath = join(__dirname, "admin_suite_tables.sql");
  const sql = readFileSync(sqlPath, "utf8");
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    await client.query(sql);
    console.log("admin_suite_tables.sql aplicado: platform_finances, system_health_logs, ai_matchmaking_history.");
  } catch (err) {
    console.error("Erro:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
