import { pool } from "../db.js";
import * as vault from "./vaultManager.js";
import { getTopGlobalHooks, refreshGlobalIntelligence } from "./platformIntelligence.js";

/**
 * Content-SEO-AEO-Agent
 * ─────────────────────────────────────────────────────────────────────────
 * Gera os artigos institucionais que cada plano promete (Basic: 1/mês,
 * Standard: 2/mês + prioridade de rank, Premium: 4/mês + campanhas em
 * destaque), escritos como um especialista em SEO, AEO (otimização para
 * motores de resposta por IA — GPTBot, ClaudeBot, PerplexityBot) e
 * copywriting de conversão, sempre em Markdown semântico pronto para
 * renderizar.
 *
 * ── Por que a cota vem do banco, não de um parâmetro da chamada ──
 * Se o chamador pudesse dizer "gera 4 artigos" para uma empresa Basic, um
 * bug em QUALQUER lugar que dispare o agente estouraria a entrega prometida
 * no contrato. O agente lê `companies.plan_type` — o mesmo campo que o
 * webhook do Stripe grava quando o pagamento confirma — e nunca aceita a
 * cota como entrada.
 *
 * ── O loop de auto-aperfeiçoamento ──
 * Cada artigo publicado grava um snapshot de engajamento (contato registrado
 * em `contact_events`, hoje o proxy mais próximo de "tráfego que converteu"
 * que o produto rastreia por empresa). Dias depois, `closeFeedbackLoop`
 * grava um segundo snapshot. Na próxima geração, `getPerformanceSnapshot`
 * lê essa diferença: os artigos cujo engajamento subiu mais emprestam suas
 * palavras-chave e tom para o prompt do próximo — é assim que o agente
 * "aprende" o que funcionou, sem precisar de um modelo de ML separado.
 */

/** Cota e destaques por plano — espelha o que a landing page promete. */
export const PLAN_ENTITLEMENTS = {
  borda: { name: "Basic", articlesPerMonth: 1, rankPriority: false, featuredCampaigns: false },
  intermediaria: { name: "Standard", articlesPerMonth: 2, rankPriority: true, featuredCampaigns: false },
  centro_premium: { name: "Premium", articlesPerMonth: 4, rankPriority: true, featuredCampaigns: true },
};

const DEFAULT_REGION = "borda";

/** Dias de observação antes de medir o efeito de um artigo publicado. */
const FEEDBACK_WINDOW_DAYS = 7;

function slugify(title) {
  return String(title)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos após decompor (café -> cafe)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export class ContentAgent {
  constructor() {
    this.agentName = "Content-SEO-AEO-Agent";
  }

  log(message, level = "INFO") {
    console.log(`[${new Date().toISOString()}] [${this.agentName}] [${level}] ${message}`);
  }

  /** Empresa + o plano que ela contratou de verdade (não o que o chamador supõe). */
  async fetchCompany(companyId) {
    const { rows } = await pool.query(
      "SELECT id, name, category, website, plan_type, payment_status FROM public.companies WHERE id = $1",
      [companyId]
    );
    return rows[0] ?? null;
  }

  entitlementsFor(planType) {
    return PLAN_ENTITLEMENTS[planType] ?? PLAN_ENTITLEMENTS[DEFAULT_REGION];
  }

  /** Quantos artigos essa empresa já recebeu no mês corrente. */
  async countArticlesThisMonth(companyId) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM public.content_articles
       WHERE company_id = $1 AND created_at >= date_trunc('month', now())`,
      [companyId]
    );
    return rows[0]?.n ?? 0;
  }

  /** Proxy de tráfego/engajamento por empresa — a métrica que o produto já rastreia. */
  async currentEngagement(companyId) {
    const { rows } = await pool.query(
      "SELECT COUNT(*)::int AS n FROM public.contact_events WHERE company_id = $1",
      [companyId]
    );
    return rows[0]?.n ?? 0;
  }

  /**
   * Histórico de performance: os últimos artigos, com o delta de
   * engajamento entre publicação e a medição feita por `closeFeedbackLoop`.
   * Isso é o "acesso a um histórico de performance" que alimenta o loop de
   * auto-aperfeiçoamento pedido — sem inventar uma métrica que o produto não
   * coleta de verdade.
   */
  async getPerformanceSnapshot(companyId) {
    const { rows } = await pool.query(
      `SELECT title, keywords, engagement_before, engagement_after
       FROM public.content_articles
       WHERE company_id = $1
       ORDER BY created_at DESC
       LIMIT 6`,
      [companyId]
    );

    const scored = rows
      .filter((r) => r.engagement_after !== null)
      .map((r) => ({ ...r, delta: r.engagement_after - r.engagement_before }))
      .sort((a, b) => b.delta - a.delta);

    const winningKeywords = [...new Set(scored.filter((r) => r.delta > 0).flatMap((r) => r.keywords))].slice(0, 8);
    const losingKeywords = [...new Set(scored.filter((r) => r.delta <= 0).flatMap((r) => r.keywords))].slice(0, 8);

    return {
      hasHistory: rows.length > 0,
      measured: scored.length,
      winningKeywords,
      losingKeywords,
      bestArticleTitle: scored[0]?.title ?? null,
      bestDelta: scored[0]?.delta ?? null,
    };
  }

  /**
   * Exploit & Explore.
   *
   * - EXPLOIT: já existe pelo menos uma medição real com ganho de
   *   engajamento (`bestDelta > 0`). O agente aprofunda o ângulo que
   *   funcionou em vez de arriscar algo novo sem necessidade.
   * - EXPLORE: ou não há medição suficiente ainda, ou o melhor resultado
   *   medido estagnou (`bestDelta <= 0`) — sinal de que repetir a mesma
   *   fórmula não vai gerar mais tráfego. O agente busca um gancho novo no
   *   Banco Central de Inteligência (tendências de OUTRAS marcas do mesmo
   *   nicho, nunca desta empresa).
   */
  decideMode(performance) {
    if (performance.measured === 0) return "explore";
    if (performance.bestDelta !== null && performance.bestDelta > 0 && performance.winningKeywords.length) {
      return "exploit";
    }
    return "explore";
  }

  /** Outras marcas ativas na mesma categoria — dado real do mural, não inventado. */
  async fetchCompetitors(companyId, category) {
    if (!category) return [];
    const { rows } = await pool.query(
      `SELECT name, website FROM public.companies
       WHERE category = $1 AND id <> $2 AND payment_status = 'active'
       ORDER BY updated_at DESC
       LIMIT 8`,
      [category, companyId]
    );
    return rows;
  }

  /**
   * Fecha o loop: para artigos publicados há mais de `FEEDBACK_WINDOW_DAYS`
   * dias e ainda sem segunda medição, grava o engajamento atual. Sem isso,
   * `getPerformanceSnapshot` nunca teria dado novo para aprender.
   */
  async closeFeedbackLoop() {
    const { rows: pending } = await pool.query(
      `SELECT id, company_id, title, engagement_before FROM public.content_articles
       WHERE engagement_after IS NULL
         AND created_at <= now() - interval '${FEEDBACK_WINDOW_DAYS} days'`
    );
    const affectedCompanies = new Set();
    for (const article of pending) {
      const engagementAfter = await this.currentEngagement(article.company_id);
      await pool.query("UPDATE public.content_articles SET engagement_after = $1 WHERE id = $2", [
        engagementAfter,
        article.id,
      ]);
      // Grava o resultado no vault da empresa — a mesma entrada de
      // publicação em `campaign_history.md` agora tem um veredito ao lado.
      await vault.appendFeedbackResult(article.company_id, {
        articleId: article.id,
        title: article.title,
        engagementBefore: article.engagement_before,
        engagementAfter,
      });
      affectedCompanies.add(article.company_id);
    }

    // Só agora o Banco Central tem novos deltas medidos para agregar — e só
    // agora `learnings.md` de cada empresa afetada tem algo novo para dizer.
    if (affectedCompanies.size > 0) {
      await refreshGlobalIntelligence().catch((err) =>
        this.log(`Falha ao atualizar o Banco Central de Inteligência: ${err.message}`, "WARN")
      );
      for (const companyId of affectedCompanies) {
        const performance = await this.getPerformanceSnapshot(companyId);
        await vault.syncLearnings(companyId, { performance, globalHooksUsed: [] }).catch((err) =>
          this.log(`Falha ao regravar learnings.md de ${companyId}: ${err.message}`, "WARN")
        );
      }
    }

    if (pending.length > 0) this.log(`Fechou o loop de performance de ${pending.length} artigo(s).`);
    return pending.length;
  }

  /**
   * System prompt: instrui o modelo a agir como especialista em SEO + AEO +
   * copywriting, sempre em Markdown, e injeta o histórico de performance —
   * é isto que faz o "auto-aperfeiçoamento" acontecer na prática: o próximo
   * artigo é escrito sabendo o que converteu antes.
   */
  buildSystemPrompt(company, entitlements, performance, { mode, vaultContext, globalHooks }) {
    const learnings = performance.hasHistory
      ? [
          performance.winningKeywords.length
            ? `Palavras-chave que já geraram mais contato/tráfego para esta marca: ${performance.winningKeywords.join(", ")}. Priorize-as quando fizer sentido.`
            : null,
          performance.losingKeywords.length
            ? `Palavras-chave usadas antes que NÃO geraram engajamento adicional: ${performance.losingKeywords.join(", ")}. Evite repeti-las sem uma abordagem nova.`
            : null,
          performance.bestArticleTitle
            ? `O artigo com melhor desempenho até agora foi "${performance.bestArticleTitle}" — inspire-se no tom, não copie a estrutura.`
            : null,
        ]
          .filter(Boolean)
          .join("\n")
      : "Esta é a primeira publicação para esta marca — não há histórico de performance ainda.";

    const strategyLine =
      mode === "exploit"
        ? "ESTRATÉGIA DESTE ARTIGO: EXPLOIT. Já existe sinal real de que um ângulo funcionou — aprofunde-o, traga um detalhe novo, não repita o artigo anterior."
        : "ESTRATÉGIA DESTE ARTIGO: EXPLORE. O histórico está vazio ou estagnado — traga um ângulo/gancho que esta marca ainda não usou.";

    const globalHooksLine = globalHooks.length
      ? `Ganchos que performaram bem em OUTRAS marcas do mesmo nicho no mural (dado agregado e anônimo — nunca cite outra marca por nome): ${globalHooks.map((h) => h.hook_value).join(", ")}.`
      : null;

    return [
      "Você é o redator institucional sênior do ConeXai, especialista simultâneo em três disciplinas:",
      "1) SEO técnico e semântico (hierarquia de headings, densidade natural de palavras-chave, meta description);",
      "2) AEO — Answer Engine Optimization: estruturar o conteúdo para ser citado por motores de resposta como GPTBot, ClaudeBot e PerplexityBot (respostas diretas logo no início de cada seção, listas escaneáveis, definições claras);",
      "3) Copywriting de conversão, sem soar como anúncio — o objetivo é gerar confiança e cliques qualificados, não hype vazio.",
      "",
      `Marca: ${company.name} · Categoria: ${company.category || "não informada"} · Site: ${company.website || "não informado"}`,
      `Plano contratado: ${entitlements.name}${entitlements.featuredCampaigns ? " (elegível a campanha em destaque)" : ""}${entitlements.rankPriority ? " (prioridade de rank no mural)" : ""}.`,
      "",
      strategyLine,
      globalHooksLine,
      "",
      "── Memória de longo prazo desta marca (vault) ──",
      "Perfil:",
      vaultContext.profile || "(sem perfil registrado ainda)",
      "Aprendizados registrados até agora:",
      vaultContext.learnings || "(sem aprendizados registrados ainda)",
      "Concorrentes mapeados no mural:",
      vaultContext.competitors || "(nenhum concorrente mapeado ainda)",
      "Trecho mais recente do histórico de campanhas:",
      vaultContext.campaignHistory || "(sem histórico ainda)",
      "",
      "Histórico de performance para auto-aperfeiçoamento (resumo estruturado):",
      learnings,
      "",
      "Regras de formato — sem exceção:",
      "- Responda SOMENTE em Markdown semântico: um único `# Título`, `##` para seções, listas com `-`, negrito com `**` apenas em termos-chave.",
      "- Nunca use HTML.",
      "- Abra cada seção principal com uma frase que responda diretamente à pergunta implícita do título — é o padrão que motores de resposta preferem citar.",
      "- Termine com uma seção `## Perguntas frequentes` com 2 a 3 perguntas curtas e respostas de 1 a 2 frases — formato ideal para featured snippets e AEO.",
      "- Não invente números, prêmios ou clientes que não foram informados.",
    ]
      .filter((line) => line !== null)
      .join("\n");
  }

  buildUserPrompt(company, entitlements, { mode, globalHooks }) {
    return [
      `Escreva um artigo institucional para a marca "${company.name}" (categoria: ${company.category || "geral"}), destinado ao blog do mural ConeXai.`,
      "O artigo deve conectar a atuação da marca a um motivo concreto para o leitor clicar no link dela no mural.",
      mode === "explore" && globalHooks.length
        ? `Use como ângulo principal o gancho "${globalHooks[0].hook_value}", adaptado à voz e ao nicho desta marca.`
        : null,
      entitlements.featuredCampaigns
        ? "Inclua uma chamada para a campanha em destaque desta marca, sem soar como anúncio pago."
        : "Não inclua chamadas de campanha paga — este plano não inclui destaque.",
      "Tamanho alvo: 350 a 550 palavras.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  /**
   * Chama um modelo de linguagem real quando há credencial configurada;
   * cai para um gerador determinístico por template quando não há — assim o
   * pipeline inteiro (cota, Markdown, gravação, loop de feedback) roda de
   * ponta a ponta em qualquer ambiente, inclusive sem chave de API.
   */
  async callLanguageModel(systemPrompt, userPrompt, fallback) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      this.log("ANTHROPIC_API_KEY ausente — usando gerador de template determinístico.", "WARN");
      return { markdown: fallback(), generatedBy: "template" };
    }

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: process.env.CONTENT_AGENT_MODEL || "claude-sonnet-5",
          max_tokens: 1400,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
      if (!res.ok) throw new Error(`Anthropic API respondeu ${res.status}`);
      const data = await res.json();
      const markdown = data?.content?.[0]?.text?.trim();
      if (!markdown) throw new Error("Resposta sem conteúdo de texto.");
      return { markdown, generatedBy: "llm" };
    } catch (err) {
      this.log(`Falha ao chamar o modelo (${err.message}) — usando fallback de template.`, "WARN");
      return { markdown: fallback(), generatedBy: "template_fallback" };
    }
  }

  /** Gerador determinístico — mantém a garantia de entrega mesmo sem LLM configurado. */
  templateMarkdown(company, entitlements, performance, seq, { mode, globalHooks }) {
    const keyword =
      mode === "exploit"
        ? performance.winningKeywords[0] || company.category || company.name
        : globalHooks[0]?.hook_value || company.category || company.name;
    const title = `${company.name}: por que ${keyword} merece um lugar permanente no mural`;
    return [
      `# ${title}`,
      "",
      `**${company.name}** ocupa um território permanente no mural ConeXai, e este artigo explica por que isso importa para quem procura ${company.category || "soluções nesta categoria"}.`,
      "",
      "## O que torna esta marca relevante agora",
      `${company.name} atua em ${company.category || "seu setor"}, e cada clique no bloco leva diretamente ao site oficial: ${company.website || "consulte o mural para o link atualizado"}.`,
      "",
      "## Como encontrar e visitar o bloco",
      "O bloco está publicado no mural interativo do ConeXai, na zona correspondente ao plano contratado, com atualização em tempo real de logo, link e descrição.",
      entitlements.featuredCampaigns ? "\nEsta marca participa do programa de campanhas em destaque do plano Premium." : "",
      "",
      "## Perguntas frequentes",
      `**O bloco desta marca é permanente?** Sim, enquanto a assinatura estiver ativa e nenhum leilão de takeover for aceito pelo proprietário.`,
      `**Como entro em contato?** Pelo link publicado diretamente no bloco do mural.`,
      "",
      `_Artigo ${seq} da cota mensal do plano ${entitlements.name}._`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  /**
   * Gera e grava a cota pendente do mês para uma empresa. Idempotente por
   * chamada: nunca gera mais do que `articlesPerMonth - já publicados`.
   *
   * Ordem obrigatória, conforme a arquitetura de memória:
   *   1. Garante que o vault existe (auto-cura para empresas antigas).
   *   2. LÊ o vault e o histórico estruturado ANTES de qualquer geração.
   *   3. Decide Exploit vs Explore.
   *   4. Gera, grava no Postgres E no vault.
   *   5. Regrava `learnings.md` e `competitors.md` com o estado mais novo.
   */
  async run(companyId) {
    const company = await this.fetchCompany(companyId);
    if (!company) return { status: "COMPANY_NOT_FOUND", companyId };
    if (company.payment_status && company.payment_status !== "active") {
      return { status: "SKIPPED_NOT_ACTIVE", companyId, paymentStatus: company.payment_status };
    }

    const planType = company.plan_type || DEFAULT_REGION;
    const entitlements = this.entitlementsFor(planType);
    const alreadyPublished = await this.countArticlesThisMonth(companyId);
    const pending = entitlements.articlesPerMonth - alreadyPublished;

    // Memória de longo prazo: cria o vault se ainda não existir (empresa
    // paga antes desta arquitetura existir, por exemplo) e mantém o perfil
    // em dia mesmo quando não há artigo pendente neste ciclo.
    await vault.ensureVault(companyId, company);
    await vault.syncProfile(companyId, company);

    if (pending <= 0) {
      return { status: "QUOTA_MET", companyId, plan: entitlements.name, alreadyPublished };
    }

    const performance = await this.getPerformanceSnapshot(companyId);
    const mode = this.decideMode(performance);
    const engagementNow = await this.currentEngagement(companyId);

    const excludeKeywords = [...performance.winningKeywords, ...performance.losingKeywords];
    const globalHooks =
      mode === "explore" ? await getTopGlobalHooks(company.category, excludeKeywords, 3) : [];

    const vaultContext = await vault.readVaultContext(companyId);
    const systemPrompt = this.buildSystemPrompt(company, entitlements, performance, {
      mode,
      vaultContext,
      globalHooks,
    });
    const userPrompt = this.buildUserPrompt(company, entitlements, { mode, globalHooks });

    this.log(
      `Modo ${mode.toUpperCase()} para ${company.name} — ` +
        (mode === "exploit"
          ? `aprofundando "${performance.winningKeywords[0]}" (Δ ${performance.bestDelta}).`
          : `${globalHooks.length} gancho(s) global(is) disponível(is) do Banco Central.`)
    );

    const created = [];
    for (let i = 0; i < pending; i++) {
      const seq = alreadyPublished + i + 1;
      const { markdown, generatedBy } = await this.callLanguageModel(systemPrompt, userPrompt, () =>
        this.templateMarkdown(company, entitlements, performance, seq, { mode, globalHooks })
      );

      const titleMatch = markdown.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1].trim() : `${company.name} no mural ConeXai`;
      const baseKeywords = mode === "exploit" ? performance.winningKeywords : globalHooks.map((h) => h.hook_value);
      const keywords = [...new Set([company.category, ...baseKeywords].filter(Boolean))].slice(0, 6);
      const metaDescription = markdown
        .split("\n")
        .find((line) => line.trim() && !line.trim().startsWith("#"))
        ?.replace(/\*\*/g, "")
        .slice(0, 155);

      const { rows } = await pool.query(
        `INSERT INTO public.content_articles
           (company_id, plan_type, title, slug, markdown, meta_description, keywords, is_featured, rank_priority, engagement_before, generated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, title, slug, is_featured, rank_priority, generated_by`,
        [
          companyId,
          planType,
          title,
          `${slugify(title)}-${seq}`,
          markdown,
          metaDescription || null,
          keywords,
          entitlements.featuredCampaigns,
          entitlements.rankPriority,
          engagementNow,
          generatedBy,
        ]
      );
      const article = rows[0];
      created.push(article);

      // O agente atualiza autonomamente a própria memória — sem isso, o
      // próximo ciclo leria um `campaign_history.md` desatualizado.
      await vault.appendCampaignEntry(companyId, {
        articleId: article.id,
        title,
        keywords,
        engagementBefore: engagementNow,
        mode,
      });

      this.log(`Publicou "${title}" para ${company.name} (${generatedBy}, ${mode}).`);
    }

    const competitors = await this.fetchCompetitors(companyId, company.category);
    await vault.syncCompetitors(companyId, competitors);
    await vault.syncLearnings(companyId, { performance, globalHooksUsed: mode === "explore" ? globalHooks : [] });

    return { status: "PUBLISHED", companyId, plan: entitlements.name, mode, articles: created };
  }

  async generateManualArticle(companyId, topic, webhookUrl) {
    this.log(`Iniciando geração manual de artigo para empresa ${companyId} com tópico "${topic}"`);
    const company = await this.fetchCompany(companyId);
    if (!company) throw new Error("Empresa não encontrada.");

    const planType = company.plan_type || DEFAULT_REGION;
    const entitlements = this.entitlementsFor(planType);

    // Prompt customizado para a geração manual
    const systemPrompt = `Você é um Content Agent especializado em SEO, AEO e Copywriting de conversão. 
A empresa alvo é "${company.name}" (nicho: ${company.category || 'Geral'}).
Escreva um artigo em Markdown engajador e semântico focando primariamente no tópico/palavra-chave: "${topic}".
O artigo deve ter:
1. Título H1 magnético (comece o markdown com o título).
2. Subtítulos H2/H3 relevantes.
3. Seção com respostas diretas e sumarizadas (AEO - Answer Engine Optimization).
4. Meta description embutida semanticamente.
5. Link para ${company.website || 'o site oficial'}.
Lembre-se de retornar SOMENTE o Markdown puro.`;

    const userPrompt = `Por favor, gere o artigo para a empresa ${company.name} focando em "${topic}".`;

    const { markdown, generatedBy } = await this.callLanguageModel(systemPrompt, userPrompt, () =>
      this.templateMarkdown(company, entitlements, { winningKeywords: [topic], losingKeywords: [], bestDelta: 0 }, 1, { mode: "exploit", globalHooks: [] })
    );

    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : `${company.name}: ${topic}`;
    const slug = `${slugify(title)}-${Date.now()}`;
    const keywords = [topic, company.category].filter(Boolean);
    const metaDescription = markdown.split("\n").find((line) => line.trim() && !line.trim().startsWith("#"))?.replace(/\*\*/g, "").slice(0, 155);

    const engagementNow = await this.currentEngagement(companyId);

    // O status no banco pode receber algo relacionado ao webhook_response se configurado, mas vamos reaproveitar o campo existing 'markdown'
    const { rows } = await pool.query(
      `INSERT INTO public.content_articles
         (company_id, plan_type, title, slug, markdown, meta_description, keywords, is_featured, rank_priority, engagement_before, generated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, title, slug, is_featured, rank_priority, generated_by`,
      [
        companyId,
        planType,
        title,
        slug,
        markdown,
        metaDescription || null,
        keywords,
        entitlements.featuredCampaigns,
        entitlements.rankPriority,
        engagementNow,
        generatedBy,
      ]
    );

    const article = rows[0];
    this.log(`Artigo manual gerado e salvo: "${title}" (${generatedBy}).`);

    // Webhook simulado/real
    if (webhookUrl) {
      this.log(`Disparando webhook para ${webhookUrl}`);
      try {
        const whRes = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ article, content: markdown })
        });
        this.log(`Webhook retornou: ${whRes.status}`);
      } catch(e) {
        this.log(`Falha ao disparar webhook: ${e.message}`, "WARN");
      }
    }

    return article;
  }
}

export default ContentAgent;
