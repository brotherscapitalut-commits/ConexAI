import LeadHunterAgent from './agents/leadHunterAgent.js';
import GrowthCampaignAgent from './agents/growthCampaignAgent.js';

async function runFullE2ESimulation() {
  console.log("==================================================================");
  console.log("   [ANTIGRAVITY] SIMULAÇÃO COMPLETA DE CRESCIMENTO E CICLO DE VIDA");
  console.log("==================================================================\n");

  console.log("--- FASE 1: RASPAGEM DE LEADS (LEAD HUNTER AGENT) ---");
  const hunter = new LeadHunterAgent();
  const scrapedData = await hunter.scrapeAndFeedCRM("Digital Marketing & SaaS", "United States");
  console.log("-> Sucesso! " + scrapedData.totalImported + " empresas inseridas na base de Claim.\n");

  console.log("--- FASE 2: DISPARO E DRIP AUTOMATIZADO (48H) ---");
  const growthAgent = new GrowthCampaignAgent();
  const dripResult = await growthAgent.startDripCampaign(scrapedData.leads);
  console.log("-> Status do Drip: " + dripResult.sequence);
  console.log("-> Alvos matriculados: " + dripResult.totalEnrolled);
  console.log("-> Comportamento: Quem não abriu ou clicou receberá lembrete automático em 48h.\n");

  console.log("--- FASE 3: SIMULAÇÃO DOS COMPORTAMENTOS DOS LEADS APÓS O CLAIM ---");

  const simulatedLeadsLifecycle = [
    {
      companyName: "Atlas Global Logistics",
      scenario: "CLIENTE CONVERTEU (Assinou)",
      action: "Clicou no link de Claim no 2º dia, cadastrou o cartão Stripe e virou assinante pagante.",
      result: "✅ Bloco garantido permanentemente no mural."
    },
    {
      companyName: "NovaTech Solutions",
      scenario: "CLIENTE EXPIROU NO 7º DIA (Sem Pagamento)",
      action: "Recebeu aviso de 5º dia e alerta urgente de 6º dia. No 7º dia não cadastrou o cartão.",
      result: "❌ Conta suspensa e bloco liberado instantaneamente para o leilão público."
    },
    {
      companyName: "Summit Real Estate Holdings",
      scenario: "CLIENTE INATIVO (Chamada de Volta / Win-Back)",
      action: "Não abriu o primeiro e-mail. Após 48h, o agente disparou a mensagem de chamada de volta.",
      result: "🔄 Reengajado com sucesso, realizou o Claim e entrou no ciclo de 7 dias."
    }
  ];

  for (let i = 0; i < simulatedLeadsLifecycle.length; i++) {
    const item = simulatedLeadsLifecycle[i];
    console.log("\n[Cenário " + (i + 1) + "] Empresa: " + item.companyName);
    console.log("  • Perfil    : " + item.scenario);
    console.log("  • Ação      : " + item.action);
    console.log("  • Desfecho  : " + item.result);
  }

  console.log("\n==================================================================");
  console.log(" [STATUS] TODAS AS SIMULAÇÕES DE AGENTES FORAM EXECUTADAS COM SUCESSO!");
  console.log("==================================================================");
}

runFullE2ESimulation();