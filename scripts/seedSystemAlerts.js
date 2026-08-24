#!/usr/bin/env node
/**
 * Insere 3 registros fictícios em system_health_logs (erros de sistema)
 * para testar o Console de Erros em /admin/system.
 * Uso: node scripts/seedSystemAlerts.js
 */

import pg from "pg";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

const connectionString =
  process.env.DATABASE_URL || "postgresql://postgres:123456@localhost:5432/muraldigital";

const FAKE_ALERTS = [
  {
    error_message: "Timeout ao carregar dados do mural",
    page_path: "/mural",
    user_email: "usuario.teste@empresa.com",
  },
  {
    error_message: "Falha na validação do formulário de campanha",
    page_path: "/dashboard",
    user_email: "anunciante@exemplo.local",
  },
  {
    error_message: "Conexão recusada ao serviço de pagamento",
    page_path: "/dashboard/influencer/ganhos",
    user_email: "influencer.ganhos@teste.local",
  },
];

async function main() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();

    for (const alert of FAKE_ALERTS) {
      await client.query(
        `INSERT INTO public.system_health_logs (service_name, status, error_message, page_path, user_email, "timestamp")
         VALUES ('api', 'error', $1, $2, $3, now())`,
        [alert.error_message, alert.page_path, alert.user_email]
      );
      console.log("Alerta inserido:", alert.error_message, "—", alert.page_path);
    }

    console.log("3 alertas de sistema fictícios inseridos. Veja em /admin/system (Console de Erros).");
  } catch (err) {
    console.error("Erro:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
