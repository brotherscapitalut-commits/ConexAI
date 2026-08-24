#!/usr/bin/env node
/**
 * Gera public/sitemap.xml a partir das rotas públicas do aplicativo.
 *
 * ── Por que um script, e não um arquivo estático ──
 * As páginas de marca (`/empresa/:id`) e de criador (`/influencer/:id`) são
 * dinâmicas. Um sitemap escrito à mão nasceria desatualizado no primeiro
 * cadastro novo. Rodar isto no build mantém o índice em dia.
 *
 * Uso:
 *   node scripts/generateSitemap.js
 *   node scripts/generateSitemap.js --base https://meudominio.com
 */
import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const baseArgIndex = process.argv.indexOf("--base");
const BASE = (
  baseArgIndex !== -1 ? process.argv[baseArgIndex + 1] : process.env.SITE_URL || "https://muraldigital.com"
).replace(/\/$/, "");

/**
 * Rotas estáticas públicas.
 *
 * `changefreq` e `priority` são dicas, não garantias — o Google as ignora em
 * boa parte. O que realmente importa aqui é a lista de URLs existir e estar
 * correta, e `lastmod` ser honesto.
 */
const STATIC_ROUTES = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/mural", priority: "0.9", changefreq: "daily" },
  { path: "/influencers", priority: "0.9", changefreq: "daily" },
  { path: "/precos", priority: "0.8", changefreq: "weekly" },
  { path: "/ranking", priority: "0.7", changefreq: "daily" },
  { path: "/guia", priority: "0.6", changefreq: "monthly" },
  { path: "/termos", priority: "0.3", changefreq: "yearly" },
];

/**
 * Entidades dinâmicas.
 *
 * Lidas dos mocks por enquanto. Quando houver banco, troque por uma consulta —
 * a estrutura do XML não muda.
 */
async function loadDynamicRoutes() {
  const routes = [];
  try {
    const { MOCK_INFLUENCERS } = await import("../src/data/influencerMockData.ts");
    for (const inf of MOCK_INFLUENCERS ?? []) {
      routes.push({ path: `/influencer/${inf.id}`, priority: "0.6", changefreq: "weekly" });
    }
  } catch {
    // Sem os mocks (ou rodando fora do projeto), o sitemap sai só com as
    // rotas estáticas em vez de falhar o build.
  }
  return routes;
}

function urlEntry({ path, priority, changefreq }, lastmod) {
  return [
    "  <url>",
    `    <loc>${BASE}${path}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    "  </url>",
  ].join("\n");
}

const lastmod = new Date().toISOString().slice(0, 10);
const dynamic = await loadDynamicRoutes();
const all = [...STATIC_ROUTES, ...dynamic];

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...all.map((r) => urlEntry(r, lastmod)),
  "</urlset>",
  "",
].join("\n");

mkdirSync(join(ROOT, "public"), { recursive: true });
writeFileSync(join(ROOT, "public", "sitemap.xml"), xml, "utf8");

console.log(`sitemap.xml gerado: ${all.length} URLs (${STATIC_ROUTES.length} estáticas, ${dynamic.length} dinâmicas)`);
console.log(`base: ${BASE}`);
