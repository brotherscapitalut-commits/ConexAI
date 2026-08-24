import LeadHunterAgent from './agents/leadHunterAgent.js';

async function runScraperTest() {
  console.log("==================================================");
  console.log("   [ANTIGRAVITY] EXECUTANDO LEAD HUNTER SCRAPER");
  console.log("==================================================\n");

  const hunter = new LeadHunterAgent();
  const result = await hunter.scrapeAndFeedCRM("Technology & Real Estate", "United States");

  console.log("\n--------------------------------------------------");
  console.log("RELATÓRIO DE IMPORTAÇÃO PARA O CRM:");
  console.log("Status: " + (result.success ? "SUCESSO" : "FALHA"));
  console.log("Total Inserido: " + result.totalImported);
  console.log("\nEmpresas Adicionadas à Base de Claim:");
  
  for (let i = 0; i < result.leads.length; i++) {
    const l = result.leads[i];
    console.log("\n[" + (i + 1) + "] " + l.companyName);
    console.log("    E-mail : " + l.email);
    console.log("    Website: " + l.website);
    console.log("    Status : " + l.status);
  }
  console.log("\n==================================================");
}

runScraperTest();