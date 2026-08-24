import AdvancedSecurityHunterAgent from './agents/securityHunterAgent.js';

async function executeRedTeam() {
  console.log("================================================================");
  console.log("   [ANTIGRAVITY RED TEAM] AGENTE INVASOR & AUDITOR DE BRECHAS");
  console.log("================================================================\n");

  const hunter = new AdvancedSecurityHunterAgent('.');
  const report = await hunter.runRedTeamAudit();

  console.log("\n----------------------------------------------------------------");
  console.log("RELATÓRIO DE INTELIGÊNCIA DE ATAQUE (PARA USO DO AGENTE CORRETOR):");
  console.log("Alvo Auditado: " + report.target);
  console.log("Total de Vulnerabilidades Identificadas: " + report.totalIssues);
  
  if (report.vulnerabilities && report.vulnerabilities.length > 0) {
    for (let i = 0; i < report.vulnerabilities.length; i++) {
      const v = report.vulnerabilities[i];
      console.log("\n[" + (i + 1) + "] SEVERIDADE: " + v.severity + " | VETOR: " + v.vector);
      console.log("    Arquivo Afetado : " + v.file);
      console.log("    Análise de Risco: " + v.description);
      console.log("    [DIRETRIZ DE CORREÇÃO PARA O AGENTE CORRETOR]: " + v.recommendation);
    }
  } else {
    console.log("\n-> [SISTEMA BLINDADO] Nenhuma brecha ou vetor de invasão detectado!");
  }
  console.log("\n================================================================");
}

executeRedTeam();