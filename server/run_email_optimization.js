import EmailConversionEngine from './agents/emailConversionEngine.js';

async function runOptimizationTest() {
  console.log("==================================================================");
  console.log("   [ANTIGRAVITY] MOTOR DE TESTES MULTIVARIANTES DE E-MAIL (A/B/C/D)");
  console.log("==================================================================\n");

  const engine = new EmailConversionEngine();
  
  // 1. Gera as variantes para um lead de teste
  const variants = engine.generateVariantCopies("NovaTech Solutions");
  console.log("-> " + variants.length + " modelos de e-mail com imagens e CTAs gerados pela IA.\n");

  // 2. Executa o teste e otimiza escalando o vencedor
  const optimizationResult = await engine.optimizeAndScaleWinner([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

  console.log("\n--------------------------------------------------");
  console.log("RESULTADO DA OTIMIZAÇÃO AUTOMÁTICA:");
  console.log("Vencedor Identificado : " + optimizationResult.winningVariant);
  console.log("Taxa de Conversão     : " + optimizationResult.conversionRate);
  console.log("Ação Executada        : " + optimizationResult.action);
  console.log("--------------------------------------------------\n");
  console.log("==================================================================");
}

runOptimizationTest();