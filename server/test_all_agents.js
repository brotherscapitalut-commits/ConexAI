import EscrowFinanceAgent from './agents/escrowFinanceAgent.js';
import AuctionDynamicPricingAgent from './agents/auctionDynamicPricingAgent.js';
import LegalComplianceAgent from './agents/legalComplianceAgent.js';
import TrafficAnalyticsAgent from './agents/trafficAnalyticsAgent.js';

async function runTest() {
  console.log("=== INICIANDO TESTE DOS AGENTES (ESM) ===\n");
  
  const finance = new EscrowFinanceAgent();
  await finance.auditHybridPricingTransaction({ plan: 'Standard', basePrice: 20.99, blockRate: 3.50, blocksCount: 10 });
  await finance.auditEscrowHoldings();
  
  const auction = new AuctionDynamicPricingAgent();
  auction.calculateZonePricing('centro_premium', 20);
  
  const compliance = new LegalComplianceAgent();
  await compliance.auditPartnershipTerms({ termsAccepted: true, offerValue: 150 });
  
  const traffic = new TrafficAnalyticsAgent();
  await traffic.auditBlockTraffic('b_01', [{ source: 'Direct', clicks: 50 }]);
  
  console.log("\n=== TODOS OS AGENTES EXECUTADOS COM SUCESSO! ===");
}

runTest();