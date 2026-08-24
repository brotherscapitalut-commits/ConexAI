import pg from "pg";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

// Usa DATABASE_URL do .env; fallback: muraldigital (sem underline).
const connectionString =
  process.env.DATABASE_URL || "postgresql://postgres:123456@localhost:5432/muraldigital";

export const pool = new pg.Pool({
  connectionString,
  max: 50, // Permite mais conexões simultâneas locais
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function query(text, params) {
  const client = await pool.connect();
  try {
    if (process.env.NODE_ENV === "development") {
      // console.log("Query Executada:", text, params); // Descomente para debugar
    }
    if (params?.userId) {
      await client.query("SET LOCAL app.current_user_id = $1", [params.userId]);
      const { userId, ...rest } = params;
      return client.query(text, rest?.length ? Object.values(rest) : []);
    }
    return client.query(text, params?.length ? Object.values(params) : []);
  } finally {
    client.release();
  }
}

export function getClient() {
  return pool.connect();
}
