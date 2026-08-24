import { pool } from "../db.js";

/**
 * Banco Central de Cruzamento de Dados (Cross-Intelligence)
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠️ Desvio deliberado do pedido original: o pedido descrevia isto como uma
 * tabela SQLite. O resto do backend inteiro — companies, blocks,
 * content_articles, contact_events — já vive no Postgres via `server/db.js`,
 * e esta inteligência só existe PARA cruzar com essas tabelas (agregando
 * `content_articles` × `contact_events` por categoria/palavra-chave).
 * Um banco separado em SQLite significaria fazer esse cruzamento em duas
 * conexões diferentes, sem transação nem JOIN — na prática, pior "banco
 * central" do que uma tabela no mesmo Postgres. Por isso `platform_hooks`
 * mora aqui, no mesmo `pool`.
 *
 * ── Como a privacidade entre empresas é garantida ──
 * Esta tabela NUNCA guarda `company_id`, título de artigo ou qualquer texto
 * gerado. Cada linha é só (tipo de gancho, valor do gancho, categoria,
 * quantas publicações de QUANTAS empresas diferentes sustentam o número,
 * ganho médio de engajamento). `refreshGlobalIntelligence` exige
 * `sample_size >= MIN_SAMPLE_SIZE` E `distinct_companies >= MIN_COMPANIES`
 * antes de publicar uma linha — um gancho que só uma empresa usou nunca vira
 * "inteligência global", porque isso vazaria exatamente o que essa empresa
 * fez.
 */

const MIN_SAMPLE_SIZE = 3;
const MIN_DISTINCT_COMPANIES = 2;

let ensured = false;

export async function ensurePlatformIntelligenceTable() {
  if (ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.platform_hooks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      hook_type TEXT NOT NULL, -- 'keyword' | 'hour_of_day'
      hook_value TEXT NOT NULL,
      category TEXT,           -- NULL = vale para qualquer categoria
      sample_size INTEGER NOT NULL,
      distinct_companies INTEGER NOT NULL,
      avg_delta NUMERIC NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (hook_type, hook_value, category)
    )
  `);
  ensured = true;
}

/**
 * Recalcula as tendências macro da plataforma a partir de dados já medidos
 * (`content_articles` com `engagement_after` preenchido, cruzado com a
 * categoria da empresa em `companies`). Barato de rodar: só olha o que
 * `ContentAgent.closeFeedbackLoop()` já fechou.
 */
export async function refreshGlobalIntelligence() {
  await ensurePlatformIntelligenceTable();

  // Ganchos de copy (palavras-chave) por categoria — cruza content_articles
  // (o que foi publicado e seu resultado) com companies (o nicho de quem
  // publicou), sem nunca selecionar `company_id` para a tabela agregada.
  const { rows: keywordRows } = await pool.query(`
    SELECT
      unnest(a.keywords) AS hook_value,
      c.category AS category,
      COUNT(*) AS sample_size,
      COUNT(DISTINCT a.company_id) AS distinct_companies,
      AVG(a.engagement_after - a.engagement_before) AS avg_delta
    FROM public.content_articles a
    JOIN public.companies c ON c.id = a.company_id
    WHERE a.engagement_after IS NOT NULL
    GROUP BY unnest(a.keywords), c.category
    HAVING COUNT(*) >= $1 AND COUNT(DISTINCT a.company_id) >= $2
  `, [MIN_SAMPLE_SIZE, MIN_DISTINCT_COMPANIES]);

  // Horário do dia com mais conversão — cruza contact_events (quando alguém
  // clicou/entrou em contato) globalmente. Sem `company_id`/`user_id` na
  // agregação: é só a distribuição por hora, útil para qualquer marca.
  const { rows: hourRows } = await pool.query(`
    SELECT EXTRACT(HOUR FROM created_at)::int AS hook_value, COUNT(*) AS sample_size
    FROM public.contact_events
    GROUP BY 1
    HAVING COUNT(*) >= $1
    ORDER BY sample_size DESC
    LIMIT 3
  `, [MIN_SAMPLE_SIZE]);

  let upserts = 0;
  for (const row of keywordRows) {
    if (!row.hook_value) continue;
    await pool.query(
      `INSERT INTO public.platform_hooks (hook_type, hook_value, category, sample_size, distinct_companies, avg_delta, updated_at)
       VALUES ('keyword', $1, $2, $3, $4, $5, now())
       ON CONFLICT (hook_type, hook_value, category)
       DO UPDATE SET sample_size = EXCLUDED.sample_size, distinct_companies = EXCLUDED.distinct_companies,
                      avg_delta = EXCLUDED.avg_delta, updated_at = now()`,
      [row.hook_value, row.category, row.sample_size, row.distinct_companies, row.avg_delta]
    );
    upserts += 1;
  }

  for (const row of hourRows) {
    await pool.query(
      `INSERT INTO public.platform_hooks (hook_type, hook_value, category, sample_size, distinct_companies, avg_delta, updated_at)
       VALUES ('hour_of_day', $1, NULL, $2, $2, 0, now())
       ON CONFLICT (hook_type, hook_value, category)
       DO UPDATE SET sample_size = EXCLUDED.sample_size, updated_at = now()`,
      [String(row.hook_value), row.sample_size]
    );
    upserts += 1;
  }

  return { keywordHooks: keywordRows.length, hourHooks: hourRows.length, upserts };
}

/**
 * Ganchos de copy que performam bem globalmente para uma categoria — usados
 * pelo agente no modo "Explore", para trazer um ângulo novo que NENHUM
 * artigo anterior desta empresa específica usou (`excludeKeywords`).
 */
export async function getTopGlobalHooks(category, excludeKeywords = [], limit = 3) {
  await ensurePlatformIntelligenceTable();
  const excluded = excludeKeywords.length ? excludeKeywords : [""];
  const { rows } = await pool.query(
    `SELECT hook_value, category, sample_size, distinct_companies, avg_delta
     FROM public.platform_hooks
     WHERE hook_type = 'keyword'
       AND (category = $1 OR category IS NULL)
       AND NOT (hook_value = ANY($2::text[]))
     ORDER BY avg_delta DESC
     LIMIT $3`,
    [category ?? null, excluded, limit]
  );
  return rows;
}

/** Melhores horários (0–23) para o agente sugerir agendamento de campanhas em destaque. */
export async function getBestConversionHours(limit = 3) {
  await ensurePlatformIntelligenceTable();
  const { rows } = await pool.query(
    `SELECT hook_value AS hour, sample_size
     FROM public.platform_hooks
     WHERE hook_type = 'hour_of_day'
     ORDER BY sample_size DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map((r) => Number(r.hour));
}

export default {
  ensurePlatformIntelligenceTable,
  refreshGlobalIntelligence,
  getTopGlobalHooks,
  getBestConversionHours,
};
