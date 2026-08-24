#!/usr/bin/env node
/**
 * Insere 3 influencers fictícios com status 'Pendente' para testar aprovação/banir em /admin/influencers.
 * Cria 3 perfis (profiles) tipo influencer e 3 registros em influencers com moderation_status = 'pending'.
 * Uso: node scripts/seedInfluencerReview.js
 */

import pg from "pg";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

const connectionString =
  process.env.DATABASE_URL || "postgresql://postgres:123456@localhost:5432/muraldigital";

const FAKE_INFLUENCERS = [
  { name: "Maria Moda Jovem", category: "Moda", niche: "streetwear", email: "maria.moda.review@teste.local" },
  { name: "Tech Bruno", category: "Tecnologia", niche: "reviews", email: "tech.bruno.review@teste.local" },
  { name: "Fitness Ana", category: "Fitness", niche: "treinos", email: "fitness.ana.review@teste.local" },
];

async function main() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();

    for (const inf of FAKE_INFLUENCERS) {
      const { rows: existing } = await client.query(
        "SELECT id FROM public.profiles WHERE email = $1",
        [inf.email]
      );
      let profileId;
      if (existing.length > 0) {
        profileId = existing[0].id;
      } else {
        const { rows: inserted } = await client.query(
          `INSERT INTO public.profiles (email, password_hash, display_name, profile_type, is_approved)
           VALUES ($1, $2, $3, 'influencer', false)
           RETURNING id`,
          [inf.email, "$2a$10$dummy.hash.for.seed.only", inf.name]
        );
        profileId = inserted[0]?.id;
      }
      if (!profileId) {
        console.warn("Perfil não criado para", inf.email);
        continue;
      }

      const { rows: existingInf } = await client.query(
        "SELECT id FROM public.influencers WHERE owner_id = $1",
        [profileId]
      );
      if (existingInf.length > 0) {
        await client.query(
          "UPDATE public.influencers SET moderation_status = 'pending' WHERE owner_id = $1",
          [profileId]
        );
        console.log("Influencer já existia, status definido para pending:", inf.name);
      } else {
        await client.query(
          `INSERT INTO public.influencers (owner_id, name, category, niche, moderation_status)
           VALUES ($1, $2, $3, $4, 'pending')`,
          [profileId, inf.name, inf.category, inf.niche]
        );
        console.log("Influencer criado (Pendente):", inf.name);
      }
    }

    console.log("3 influencers fictícios com status Pendente prontos. Teste em /admin/influencers.");
  } catch (err) {
    console.error("Erro:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
