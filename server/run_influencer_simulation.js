import { InfluencerHunterAgent, CopywriterCampaignAgent } from './agents/influencerCampaignAgent.js';

async function executeInfluencerCampaignPipeline() {
  console.log("==================================================================");
  console.log("   [ANTIGRAVITY] PIPELINE DE INFLUENCIADORES & COPYWRITING DE IA");
  console.log("==================================================================\n");

  // 1. Caça aos Influenciadores
  console.log("--- FASE 1: VARREDURA E MAPEAMENTO DE CRIADORES ---");
  const hunter = new InfluencerHunterAgent();
  const influencersList = await hunter.scrapeAndFindInfluencers("Tech, Startups & Business");
  console.log("-> Total de criadores qualificados encontrados: " + influencersList.length + "\n");

  // 2. Acionamento dos Redatores para Criação do Material de Campanha
  console.log("--- FASE 2: REDATORES DE IA GERANDO MATERIAL PERSONALIZADO ---");
  const copywriter = new CopywriterCampaignAgent();
  
  for (let i = 0; i < influencersList.length; i++) {
    const inf = influencersList[i];
    const campaign = copywriter.generateCustomCampaign(inf);
    
    console.log("\n[MATERIAL GERADO PARA: " + campaign.influencerName + "]");
    console.log("  • E-mail de Convite : " + campaign.emailInvite);
    console.log("  • Copy para Post    : " + campaign.socialPostCopy);
    console.log("  • Roteiro de Vídeo  : " + campaign.scriptReels);
    console.log("------------------------------------------------------------------");
  }

  console.log("\n==================================================================");
  console.log(" [STATUS] MATERIAIS DE CAMPANHA DE INFLUENCIADORES PRONTOS PARA DISPARO!");
  console.log("==================================================================");
}

executeInfluencerCampaignPipeline();