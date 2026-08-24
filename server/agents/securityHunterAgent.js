import fs from 'fs';
import path from 'path';

export default class AdvancedSecurityHunterAgent {
  constructor(targetDir) {
    this.targetDir = targetDir || '.';
    this.agentName = "Antigravity-RedTeam-Hunter";
    this.vulnerabilitiesFound = [];
  }

  log(message, level) {
    console.log('[' + new Date().toISOString() + '] [' + this.agentName + '] [' + (level || 'INFO') + '] ' + message);
  }

  scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fullPath = path.join(dir, file);
      
      // Ignora pastas irrelevantes, mas audita src, server e public
      if (['node_modules', '.git', 'dist', 'build'].includes(file)) continue;

      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        this.scanDirectory(fullPath);
      } else if (stat.isFile() && /\.(js|ts|tsx|jsx|cjs|html)$/.test(file)) {
        // Ignora a si mesmo para evitar falsos positivos
        if (file === 'securityHunterAgent.js') continue;
        this.analyzeFile(fullPath);
      }
    }
  }

  analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');

    // 1. Detecção de RCE / Eval
    if (content.indexOf('eval(') !== -1) {
      this.vulnerabilitiesFound.push({
        file: filePath,
        severity: 'CRITICAL',
        vector: 'Remote Code Execution (RCE)',
        description: 'Presença de eval() permitindo execução arbitrária de código.',
        recommendation: 'Substituir eval() por parsers seguros como JSON.parse() ou lógica estática.'
      });
    }

    // 2. Chaves de API ou segredos hardcoded no código ou HTML
    if (/['"][a-zA-Z0-9_\-]{20,}(sk_live_|key-|api_key|secret)[a-zA-Z0-9_\-]*['"]/.test(content) || content.indexOf('password =') !== -1) {
      this.vulnerabilitiesFound.push({
        file: filePath,
        severity: 'HIGH',
        vector: 'Hardcoded Credentials / API Secrets',
        description: 'Credenciais sensíveis ou chaves de API expostas em texto plano no código-fonte.',
        recommendation: 'Mover todas as credenciais para variáveis de ambiente (.env) e acessá-las via process.env.'
      });
    }

    // 3. Endpoints de API ou rotas sem checagem aparente de Middleware de Auth
    if (content.indexOf('app.get(\'/api/admin') !== -1 && content.indexOf('authenticateToken') === -1 && content.indexOf('auth') === -1) {
      this.vulnerabilitiesFound.push({
        file: filePath,
        severity: 'HIGH',
        vector: 'Broken Authentication / Unauthorized Admin Route',
        description: 'Rota administrativa exposta sem middleware visível de autenticação.',
        recommendation: 'Adicionar o middleware de segurança/JWT em todas as rotas sensíveis de /api/admin.'
      });
    }

    // 4. Vazamento de dados em logs no console
    if (/console\.log\s*\([^)]*(token|password|secret|auth)[^)]*\)/i.test(content)) {
      this.vulnerabilitiesFound.push({
        file: filePath,
        severity: 'MEDIUM',
        vector: 'Sensitive Information Leak via Logs',
        description: 'Impressão de tokens ou credenciais confidenciais diretamente no console do servidor/navegador.',
        recommendation: 'Remover o log de variáveis confidenciais e utilizar mascaramento de dados.'
      });
    }
  }

  async runRedTeamAudit() {
    this.log("Iniciando Operação Red Team: Varredura de Invasão e Vulnerabilidades em " + this.targetDir);
    this.vulnerabilitiesFound = [];
    
    try {
      this.scanDirectory(this.targetDir);
      this.log("Varredura Red Team concluída. Alertas identificados: " + this.vulnerabilitiesFound.length);
      
      return {
        status: 'COMPLETED',
        target: this.targetDir,
        totalIssues: this.vulnerabilitiesFound.length,
        vulnerabilities: this.vulnerabilitiesFound
      };
    } catch (err) {
      this.log("Erro na varredura Red Team: " + err.message, "ERROR");
      return { status: 'FAILED', error: err.message };
    }
  }
}