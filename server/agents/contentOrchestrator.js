import { pool } from "../db.js";
import { ContentAgent } from "./contentAgent.js";

/**
 * Orquestra o Content-SEO-AEO-Agent sobre todas as empresas ativas.
 *
 * Separado do agente em si por um motivo simples: o agente sabe gerar
 * conteúdo para UMA empresa; decidir QUAIS empresas processar, em qual
 * ordem, e o que fazer com falhas parciais é uma responsabilidade diferente
 * — de orquestração, não de geração. Isso também é o que permite outros
 * agentes (Traffic-Analytics, Growth-Campaign, etc.) entrarem no mesmo ciclo
 * no futuro sem reescrever o ContentAgent.
 */
export class ContentOrchestrator {
  constructor() {
    this.agent = new ContentAgent();
  }

  log(message) {
    console.log(`[${new Date().toISOString()}] [Content-Orchestrator] ${message}`);
  }

  /** Roda o ciclo completo: fecha o loop de feedback pendente, depois gera a cota do mês. */
  async runFullCycle() {
    const closed = await this.agent.closeFeedbackLoop();

    const { rows: companies } = await pool.query(
      "SELECT id, name FROM public.companies WHERE payment_status = 'active'"
    );

    const results = [];
    for (const company of companies) {
      try {
        const result = await this.agent.run(company.id);
        results.push(result);
      } catch (err) {
        this.log(`Falha ao gerar conteúdo para ${company.name} (${company.id}): ${err.message}`);
        results.push({ status: "ERROR", companyId: company.id, error: err.message });
      }
    }

    const summary = {
      companiesConsidered: companies.length,
      feedbackLoopClosed: closed,
      published: results.filter((r) => r.status === "PUBLISHED").length,
      quotaAlreadyMet: results.filter((r) => r.status === "QUOTA_MET").length,
      errors: results.filter((r) => r.status === "ERROR").length,
      results,
    };
    this.log(
      `Ciclo concluído — ${summary.published} empresa(s) receberam artigo novo, ` +
        `${summary.quotaAlreadyMet} já estavam com a cota do mês em dia, ${summary.errors} erro(s).`
    );
    return summary;
  }

  /** Roda o agente para uma única empresa — usado pelo endpoint manual e por outros fluxos internos. */
  async runForCompany(companyId) {
    return this.agent.run(companyId);
  }
}

let dailyTimer = null;

/**
 * Liga o ciclo diário automático. Fica atrás de uma env var deliberadamente:
 * rodar em produção sem querer (ex.: um `npm run dev` local) geraria
 * artigos e chamadas de LLM reais para todas as empresas de teste.
 */
export function scheduleDailyContentCycle() {
  if (dailyTimer) return dailyTimer;
  if (process.env.ENABLE_CONTENT_AGENT_CRON !== "true") {
    console.log(
      "[Content-Orchestrator] ciclo diário desligado (defina ENABLE_CONTENT_AGENT_CRON=true no .env para ativar)."
    );
    return null;
  }

  const orchestrator = new ContentOrchestrator();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  dailyTimer = setInterval(() => {
    orchestrator.runFullCycle().catch((err) => {
      console.error("[Content-Orchestrator] ciclo diário falhou:", err.message);
    });
  }, ONE_DAY_MS);
  console.log("[Content-Orchestrator] ciclo diário agendado (a cada 24h).");
  return dailyTimer;
}

export default ContentOrchestrator;
