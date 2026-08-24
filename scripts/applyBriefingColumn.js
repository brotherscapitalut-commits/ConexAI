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
  const sqlPath = join(__dirname, "add_briefing_column.sql");
  const sql = readFileSync(sqlPath, "utf8");
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    await client.query(sql);
    console.log("add_briefing_column.sql aplicado: briefing column added to partnership_proposals.");
  } catch (err) {
    console.error("Erro:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
