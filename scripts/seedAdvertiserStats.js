#!/usr/bin/env node
/**
 * Insere 2 empresas de teste (anunciantes) com saldos R$ 1.000,00 e R$ 0,00
 * para testar a gestão em /admin/users (tabela de clientes, ajuste de saldo).
 * Uso: node scripts/seedAdvertiserStats.js
 */

import pg from "pg";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

const connectionString =
  process.env.DATABASE_URL || "postgresql://postgres:123456@localhost:5432/muraldigital";

const ADVERTISERS = [
  { name: "Empresa Teste Mil", email: "empresa.mil@teste.local", balance: 1000 },
  { name: "Empresa Teste Zero", email: "empresa.zero@teste.local", balance: 0 },
];

async function main() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();

    for (const adv of ADVERTISERS) {
      const { rows: existing } = await client.query(
        "SELECT id FROM public.profiles WHERE email = $1",
        [adv.email]
      );
      let profileId;
      if (existing.length > 0) {
        profileId = existing[0].id;
      } else {
        const { rows: inserted } = await client.query(
          `INSERT INTO public.profiles (email, password_hash, display_name, profile_type, is_approved)
           VALUES ($1, $2, $3, 'company', true)
           RETURNING id`,
          [adv.email, "$2a$10$dummy.hash.for.seed.only", adv.name]
        );
        profileId = inserted[0]?.id;
      }
      if (!profileId) {
        console.warn("Perfil não criado para", adv.email);
        continue;
      }

      const { rows: existingRole } = await client.query(
        "SELECT 1 FROM public.user_roles WHERE user_id = $1",
        [profileId]
      );
      if (existingRole.length === 0) {
        await client.query(
          "INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'advertiser')",
          [profileId]
        );
      }

      const { rows: existingCompany } = await client.query(
        "SELECT id FROM public.companies WHERE owner_id = $1",
        [profileId]
      );
      if (existingCompany.length > 0) {
        await client.query(
          "UPDATE public.companies SET influencer_credits_balance = $1, name = $2 WHERE owner_id = $3",
          [adv.balance, adv.name, profileId]
        );
        console.log("Empresa atualizada:", adv.name, "Saldo R$", adv.balance.toFixed(2));
      } else {
        await client.query(
          `INSERT INTO public.companies (owner_id, name, influencer_credits_balance)
           VALUES ($1, $2, $3)`,
          [profileId, adv.name, adv.balance]
        );
        console.log("Empresa criada:", adv.name, "Saldo R$", adv.balance.toFixed(2));
      }
    }

    console.log("2 empresas de teste prontas. Teste em /admin/users.");
  } catch (err) {
    console.error("Erro:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
