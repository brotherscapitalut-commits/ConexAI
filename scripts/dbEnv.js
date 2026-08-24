#!/usr/bin/env node
/**
 * Deriva as credenciais do Postgres a partir do DATABASE_URL.
 *
 * ── Por que este script existe ──
 * O docker-compose.yml precisa de POSTGRES_USER / POSTGRES_PASSWORD /
 * POSTGRES_DB / POSTGRES_PORT para criar o container, e a aplicação precisa
 * de DATABASE_URL para se conectar. Manter os dois no .env cria duas fontes
 * de verdade para a mesma informação — e foi exatamente isso que quebrou:
 * o .env tinha só DATABASE_URL, o compose caiu nos valores padrão e criou o
 * banco com uma senha diferente da que a aplicação usava. Resultado:
 * "password authentication failed for user postgres".
 *
 * Aqui o DATABASE_URL é a única fonte de verdade e todo o resto é derivado.
 *
 * Uso:
 *   node scripts/dbEnv.js          → imprime KEY=value (uma por linha)
 *   node scripts/dbEnv.js --check  → testa a conexão; sai 0 ok, 2 auth, 3 outro
 */
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

const RAW = process.env.DATABASE_URL || "";

if (!RAW) {
  console.error("DATABASE_URL não definido no .env");
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(RAW);
} catch {
  console.error(`DATABASE_URL inválido: não é uma URL válida.`);
  process.exit(1);
}

const values = {
  POSTGRES_USER: decodeURIComponent(parsed.username || "postgres"),
  POSTGRES_PASSWORD: decodeURIComponent(parsed.password || "postgres"),
  POSTGRES_DB: (parsed.pathname || "/postgres").replace(/^\//, "") || "postgres",
  POSTGRES_PORT: parsed.port || "5432",
  POSTGRES_CONTAINER: process.env.POSTGRES_CONTAINER || "supabase_local",
};

/**
 * A senha viaja até o docker-compose através de `set "KEY=valor"` no batch.
 * O `%` inicia expansão de variável e o `!` é expandido quando
 * EnableDelayedExpansion está ativo (que é o caso do iniciar_projeto.bat) —
 * qualquer um dos dois seria comido pelo interpretador e o container acabaria
 * criado com uma senha truncada, reproduzindo o mesmo bug de autenticação de
 * forma ainda mais difícil de diagnosticar.
 *
 * O aviso vai para stderr de propósito: o stdout carrega os pares KEY=value
 * que o batch consome, e sujá-lo quebraria o parse.
 */
const RISKY_FOR_BATCH = /[%!]/;
if (RISKY_FOR_BATCH.test(values.POSTGRES_PASSWORD)) {
  console.error(
    "[dbEnv] AVISO: a senha contém '%' ou '!', caracteres que o interpretador " +
      "de .bat do Windows expande. O container pode acabar com uma senha " +
      "diferente da esperada. Prefira uma senha sem esses dois caracteres."
  );
}

if (!process.argv.includes("--check")) {
  for (const [k, v] of Object.entries(values)) console.log(`${k}=${v}`);
  process.exit(0);
}

// ── Modo --check: valida que dá para conectar de verdade ──
const { default: pg } = await import("pg");
const client = new pg.Client({ connectionString: RAW, connectionTimeoutMillis: 5000 });

try {
  await client.connect();
  const { rows } = await client.query(
    "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'"
  );
  await client.end();
  console.log(`OK ${rows[0].n}`); // "OK <numero de tabelas>"
  process.exit(0);
} catch (err) {
  const msg = String(err?.message || err);
  // 28P01 = invalid_password; 28000 = invalid_authorization_specification
  if (err?.code === "28P01" || err?.code === "28000" || /password authentication failed/i.test(msg)) {
    console.error(`AUTH ${msg}`);
    process.exit(2);
  }
  console.error(`ERR ${msg}`);
  process.exit(3);
}
