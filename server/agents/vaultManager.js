import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Vault Markdown por empresa (estilo Obsidian)
 * ─────────────────────────────────────────────────────────────────────────
 * Cada empresa assinante ganha uma pasta isolada em `server/vaults/company_<id>/`
 * com quatro arquivos `.md` que juntos formam a memória de longo prazo que os
 * agentes leem ANTES de gerar qualquer conteúdo novo:
 *
 *   profile.md           — quem é a marca (nicho, tom de voz, URL)
 *   campaign_history.md  — log cronológico, append-only, do que já foi publicado
 *   competitors.md       — outras marcas do mesmo nicho mapeadas no mural
 *   learnings.md         — resumo vivo: o que funcionou (exploit) vs o que
 *                           esgotou e deve dar lugar a algo novo (explore)
 *
 * ── Por que arquivo, e não só a tabela `content_articles` no Postgres ──
 * A tabela é a fonte estruturada — o que se agrega, cruza e consulta com
 * SQL. O vault é a camada NARRATIVA: o texto que entra literalmente no
 * prompt do agente, no formato que um redator humano leria para "se
 * lembrar" do histórico de uma conta antes de escrever. Um `SELECT *`
 * formatado às pressas no prompt não tem o mesmo peso que um arquivo que o
 * próprio agente escreveu para o seu eu futuro.
 *
 * ── Por que `campaign_history.md` é append-only ──
 * Histórico editado deixa de ser histórico. Cada execução do agente
 * ACRESCENTA uma entrada (publicação) e, mais tarde, uma segunda entrada
 * (resultado medido) — nunca reescreve uma entrada anterior. `learnings.md`
 * é o oposto: um resumo DERIVADO do histórico, seguro para regravar por
 * inteiro a cada ciclo, porque não é fonte primária de nada.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const VAULTS_ROOT = path.join(__dirname, "..", "vaults");

function vaultDir(companyId) {
  return path.join(VAULTS_ROOT, `company_${companyId}`);
}

function filePath(companyId, filename) {
  return path.join(vaultDir(companyId), filename);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** Escapa o mínimo necessário para não quebrar uma tabela/lista Markdown com dados do usuário. */
function mdSafe(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

/**
 * Cria a pasta e os quatro arquivos do vault se ainda não existirem.
 * Idempotente — chamar de novo numa empresa que já tem vault não apaga nada.
 * Deve ser chamada assim que o pagamento é confirmado (`payment_status = 'active'`),
 * mas também é segura de chamar sob demanda como auto-cura para empresas
 * antigas que ainda não têm vault.
 */
export async function ensureVault(companyId, company) {
  const dir = vaultDir(companyId);
  await fs.mkdir(dir, { recursive: true });

  const defaults = {
    "profile.md": renderProfile(company),
    "campaign_history.md": [
      "# Histórico de campanhas",
      "",
      "Log cronológico e append-only. Cada publicação gera uma entrada; cada",
      "medição de resultado gera outra, ligada pelo mesmo `article_id`.",
      "",
    ].join("\n"),
    "competitors.md": [
      "# Concorrentes mapeados",
      "",
      "Outras marcas no mesmo nicho, publicadas no mural ConeXai. Atualizado",
      "automaticamente pelo agente a cada ciclo de conteúdo.",
      "",
    ].join("\n"),
    "learnings.md": [
      "# Aprendizados contínuos",
      "",
      "_Ainda sem histórico suficiente para gerar recomendações. O primeiro",
      "artigo desta marca vai popular esta seção._",
      "",
    ].join("\n"),
  };

  let created = false;
  for (const [name, initialContent] of Object.entries(defaults)) {
    const target = filePath(companyId, name);
    try {
      await fs.access(target);
    } catch {
      await fs.writeFile(target, initialContent, "utf8");
      created = true;
    }
  }
  return { dir, created };
}

function renderProfile(company) {
  return [
    "# Perfil institucional",
    "",
    `- **Marca:** ${mdSafe(company?.name) || "—"}`,
    `- **Nicho/categoria:** ${mdSafe(company?.category) || "não informado"}`,
    `- **URL:** ${mdSafe(company?.website) || "não informado"}`,
    `- **Plano:** ${mdSafe(company?.plan_type) || "não informado"}`,
    `- **Tom de voz:** ${mdSafe(company?.tone) || "profissional, direto, sem hype vazio (padrão até refinarmos)"}`,
    "",
    `_Atualizado em ${todayIso()}._`,
    "",
  ].join("\n");
}

/** Regrava `profile.md` do zero — seguro porque é um retrato do estado atual, não um log. */
export async function syncProfile(companyId, company) {
  await fs.mkdir(vaultDir(companyId), { recursive: true });
  await fs.writeFile(filePath(companyId, "profile.md"), renderProfile(company), "utf8");
}

/** Lê um arquivo do vault; devolve `""` se ainda não existir (agente novo, vault recém-criado). */
async function readFile(companyId, filename) {
  try {
    return await fs.readFile(filePath(companyId, filename), "utf8");
  } catch {
    return "";
  }
}

async function appendFile(companyId, filename, chunk) {
  await fs.mkdir(vaultDir(companyId), { recursive: true });
  await fs.appendFile(filePath(companyId, filename), chunk, "utf8");
}

/**
 * Registra a publicação de um artigo no log de campanhas. Chamado pelo
 * ContentAgent logo após gravar o artigo em `content_articles` — o `id`
 * retornado pelo INSERT é o elo entre a linha do banco e a entrada do vault.
 */
export async function appendCampaignEntry(companyId, { articleId, title, keywords, engagementBefore, mode }) {
  const entry = [
    `## ${todayIso()} — ${mdSafe(title)}`,
    `- article_id: ${articleId}`,
    `- estratégia: ${mode === "exploit" ? "Exploit (refinar ângulo que já converteu)" : "Explore (novo gancho de mercado)"}`,
    `- keywords: ${(keywords || []).map(mdSafe).join(", ") || "—"}`,
    `- engagement no momento da publicação: ${engagementBefore}`,
    `- resultado: _pendente (medido após a janela de observação)_`,
    "",
  ].join("\n");
  await appendFile(companyId, "campaign_history.md", entry);
}

/**
 * Registra o RESULTADO de um artigo já publicado, sem reescrever a entrada
 * original — é uma nova entrada no mesmo log, referenciando o `article_id`.
 * Chamado por `ContentAgent.closeFeedbackLoop()`.
 */
export async function appendFeedbackResult(companyId, { articleId, title, engagementBefore, engagementAfter }) {
  const delta = engagementAfter - engagementBefore;
  const verdict = delta > 0 ? "✅ gerou engajamento adicional" : delta === 0 ? "➖ neutro" : "⚠️ sem ganho — candidato a Explore no próximo ciclo";
  const entry = [
    `## ${todayIso()} — resultado de "${mdSafe(title)}"`,
    `- article_id: ${articleId}`,
    `- engagement antes → depois: ${engagementBefore} → ${engagementAfter} (Δ ${delta >= 0 ? "+" : ""}${delta})`,
    `- veredito: ${verdict}`,
    "",
  ].join("\n");
  await appendFile(companyId, "campaign_history.md", entry);
}

/**
 * Regrava `learnings.md` por inteiro — é um resumo DERIVADO, calculado a
 * partir do que `ContentAgent.getPerformanceSnapshot` já apurou no Postgres.
 * O vault aqui só guarda a versão legível do que o banco sabe.
 */
export async function syncLearnings(companyId, { performance, globalHooksUsed = [] }) {
  const lines = ["# Aprendizados contínuos", ""];

  if (!performance.hasHistory) {
    lines.push("_Ainda sem histórico suficiente para gerar recomendações._", "");
  } else {
    lines.push("## O que funcionou (Exploit)");
    lines.push(
      performance.winningKeywords.length
        ? performance.winningKeywords.map((k) => `- **${mdSafe(k)}** — reaproveitar e aprofundar o ângulo.`).join("\n")
        : "_Nenhuma palavra-chave com ganho claro ainda — todas as próximas entradas contam como Explore._"
    );
    lines.push("");
    lines.push("## O que esgotou (hora de Explorar)");
    lines.push(
      performance.losingKeywords.length
        ? performance.losingKeywords.map((k) => `- ~~${mdSafe(k)}~~ — sem ganho adicional; evitar repetir sem um ângulo novo.`).join("\n")
        : "_Nada esgotado até agora._"
    );
    lines.push("");
    if (performance.bestArticleTitle) {
      lines.push(`## Melhor artigo até agora`, `"${mdSafe(performance.bestArticleTitle)}" — usar como referência de tom, não de estrutura.`, "");
    }
  }

  if (globalHooksUsed.length) {
    lines.push("## Ganchos globais injetados neste ciclo (Banco Central de Inteligência)");
    lines.push(
      globalHooksUsed
        .map((h) => `- **${mdSafe(h.hook_value)}** — desempenho médio de +${Number(h.avg_delta).toFixed(1)} contato(s) em ${h.sample_size} publicações de outras marcas do setor.`)
        .join("\n")
    );
    lines.push("");
  }

  lines.push(`_Regenerado em ${todayIso()}._`, "");

  await fs.mkdir(vaultDir(companyId), { recursive: true });
  await fs.writeFile(filePath(companyId, "learnings.md"), lines.join("\n"), "utf8");
}

/**
 * Regrava `competitors.md` a partir de outras empresas ATIVAS na mesma
 * categoria — dado real do próprio mural, não inventado. `excludeSelfId`
 * evita que a marca apareça na própria lista de concorrentes.
 */
export async function syncCompetitors(companyId, competitors) {
  const lines = [
    "# Concorrentes mapeados",
    "",
    "Outras marcas no mesmo nicho, publicadas no mural ConeXai.",
    "",
  ];
  if (!competitors.length) {
    lines.push("_Nenhuma outra marca da mesma categoria publicada no mural ainda._");
  } else {
    for (const c of competitors) {
      lines.push(`- **${mdSafe(c.name)}**${c.website ? ` — ${mdSafe(c.website)}` : ""}`);
    }
  }
  lines.push("", `_Atualizado em ${todayIso()}._`, "");

  await fs.mkdir(vaultDir(companyId), { recursive: true });
  await fs.writeFile(filePath(companyId, "competitors.md"), lines.join("\n"), "utf8");
}

/**
 * Lê o vault inteiro para injeção no prompt do agente. Trunca cada arquivo a
 * um teto de caracteres — um `campaign_history.md` de um ano de histórico
 * não pode estourar o contexto do modelo; o mais recente é o que mais
 * importa, então mantemos o FIM do arquivo (as entradas mais novas).
 */
export async function readVaultContext(companyId, { maxCharsPerFile = 2000 } = {}) {
  const [profile, campaignHistory, competitors, learnings] = await Promise.all([
    readFile(companyId, "profile.md"),
    readFile(companyId, "campaign_history.md"),
    readFile(companyId, "competitors.md"),
    readFile(companyId, "learnings.md"),
  ]);

  const tail = (text) => (text.length > maxCharsPerFile ? text.slice(-maxCharsPerFile) : text);

  return {
    profile,
    campaignHistory: tail(campaignHistory),
    competitors,
    learnings,
  };
}

export default {
  VAULTS_ROOT,
  ensureVault,
  syncProfile,
  appendCampaignEntry,
  appendFeedbackResult,
  syncLearnings,
  syncCompetitors,
  readVaultContext,
};
