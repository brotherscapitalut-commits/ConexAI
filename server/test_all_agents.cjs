/**
 * test_all_agents.cjs
 * Script de teste unificado para validar o ecossistema de agentes do ConexAi.
 */

const EscrowFinanceAgent = require('./agents/escrowFinanceAgent.js');
const AuctionDynamicPricingAgent = require('./agents/auctionDynamicPricingAgent.js');
const LegalComplianceAgent = require('./agents/legalComplianceAgent.js');
const TrafficAnalyticsAgent = require('./agents/trafficAnalyticsAgent.js');

async function runSystemTest() {
  console.log("=== INICIANDO TESTE INTEGRADO DO ECOSSISTEMA DE AGENTES DO CONEXAI ===\\n");

  // 1. Teste Escrow & Finance
  const financeAgent = new EscrowFinanceAgent();
  await financeAgent.auditHybridPricingTransaction({ plan: 'Standard', basePrice: 20.99, blockRate: 3.50, blocksCount: 10 });
  await financeAgent.auditEscrowHoldings();

  console.log("\\n-------------------------------------------\\n");

  // 2. Teste Leilões e Preços Dinâmicos
  const auctionAgent = new AuctionDynamicPricingAgent();
  auctionAgent.calculateZonePricing('borda', 4);
  auctionAgent.calculateZonePricing('centro_premium', 20);

  console.log("\\n-------------------------------------------\\n");

  // 3. Teste Jurídico e Compliance
  const complianceAgent = new LegalComplianceAgent();
  await complianceAgent.auditPartnershipTerms({ id: 'p_999', brandId: 'b_123', influencerId: 'inf_456', termsAccepted: true, offerValue: 150.00 });

  console.log("\\n-------------------------------------------\\n");

  // 4. Teste de Tráfego e Analytics
  const trafficAgent = new TrafficAnalyticsAgent();
  await trafficAgent.auditBlockTraffic('block_j18', [
    { source: 'Direct', clicks: 45 },
    { source: 'Mural Search', clicks: 110 },
    { source: 'Social Media', clicks: 25 }
  ]);

  console.log("\\n=== TESTE CONCLUÍDO COM SUCESSO: TODOS OS AGENTES OPERACIONAIS! ===");
}

runSystemTest();
