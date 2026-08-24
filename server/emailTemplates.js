/**
 * Templates de e-mail em HTML — identidade visual ConeXai (dourado/âmbar, fundo escuro).
 * Cores alinhadas ao tema do app.
 */

const BRAND = "ConeXai";
const PRIMARY_HEX = "#f59e0b";
const BG_DARK = "#1c1917";
const TEXT_LIGHT = "#fafaf9";
const MUTED = "#a8a29e";

function wrapDocument(innerHtml) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${BRAND}</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',system-ui,sans-serif;background-color:${BG_DARK};color:${TEXT_LIGHT};">
  <div style="max-width:520px;margin:0 auto;padding:24px;">
    ${innerHtml}
    <p style="margin-top:24px;font-size:12px;color:${MUTED};">
      Este e-mail foi enviado por ${BRAND}. Você está recebendo porque possui uma conta na plataforma.
    </p>
  </div>
</body>
</html>`;
}

/**
 * E-mail: Nova oferta recebida (valor líquido = Total - 30%; não exibir % da plataforma).
 */
function getNovaOfertaHtml(valorLiquido, companyName = "") {
  const valorFormatado = Number(valorLiquido).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
  const inner = `
    <div style="text-align:center;margin-bottom:20px;">
      <span style="font-size:18px;font-weight:700;color:${PRIMARY_HEX};">${BRAND}</span>
    </div>
    <div style="background:rgba(255,255,255,0.05);border-radius:12px;padding:20px;border:1px solid rgba(245,158,11,0.2);">
      <h1 style="font-size:20px;margin:0 0 12px 0;color:${TEXT_LIGHT};">Nova oferta recebida</h1>
      <p style="margin:0 0 16px 0;color:${MUTED};line-height:1.5;">
        ${companyName ? `Olá, <strong>${companyName}</strong>. ` : ""}Alguém fez uma oferta pela sua posição no mural.
      </p>
      <p style="margin:0;font-size:24px;font-weight:700;color:${PRIMARY_HEX};">
        Valor que você recebe: ${valorFormatado}
      </p>
      <p style="margin:12px 0 0 0;font-size:14px;color:${MUTED};">
        Acesse seu dashboard para aceitar ou recusar a oferta.
      </p>
    </div>`;
  return wrapDocument(inner);
}

/**
 * E-mail: Venda concluída — confirmação de que o saldo foi atualizado (influencer_credits_balance).
 */
function getVendaConcluidaHtml(valorCreditado, companyName = "") {
  const valorFormatado = Number(valorCreditado).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
  const inner = `
    <div style="text-align:center;margin-bottom:20px;">
      <span style="font-size:18px;font-weight:700;color:${PRIMARY_HEX};">${BRAND}</span>
    </div>
    <div style="background:rgba(255,255,255,0.05);border-radius:12px;padding:20px;border:1px solid rgba(34,197,94,0.3);">
      <h1 style="font-size:20px;margin:0 0 12px 0;color:${TEXT_LIGHT};">Venda concluída</h1>
      <p style="margin:0 0 16px 0;color:${MUTED};line-height:1.5;">
        ${companyName ? `Olá, <strong>${companyName}</strong>. ` : ""}Seu lance foi aceito e a posição foi transferida ao comprador.
      </p>
      <p style="margin:0;font-size:22px;font-weight:700;color:#22c55e;">
        ${valorFormatado} já foi creditado no seu saldo (influencer_credits_balance).
      </p>
      <p style="margin:12px 0 0 0;font-size:14px;color:${MUTED};">
        Você pode usar o saldo para campanhas e ofertas a influencers.
      </p>
    </div>`;
  return wrapDocument(inner);
}

export { getNovaOfertaHtml, getVendaConcluidaHtml, BRAND };
