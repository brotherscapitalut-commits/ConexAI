/**
 * EmailService genérico — preparado para Resend, SendGrid ou Mailgun.
 * Variáveis de ambiente: EMAIL_PROVIDER, FROM_EMAIL, FROM_NAME,
 * e conforme o provedor: RESEND_API_KEY | SENDGRID_API_KEY | MAILGUN_API_KEY + MAILGUN_DOMAIN.
 */

import { getNovaOfertaHtml, getVendaConcluidaHtml } from "./emailTemplates.js";

const PROVIDERS = ["resend", "sendgrid", "mailgun"];

function getConfig() {
  const provider = (process.env.EMAIL_PROVIDER || "").toLowerCase();
  const fromEmail = process.env.FROM_EMAIL || "noreply@muraldigital.com";
  const fromName = process.env.FROM_NAME || "ConeXai";
  return {
    provider: PROVIDERS.includes(provider) ? provider : null,
    from: `${fromName} <${fromEmail}>`,
    fromEmail,
    fromName,
    resendKey: process.env.RESEND_API_KEY,
    sendgridKey: process.env.SENDGRID_API_KEY,
    mailgunKey: process.env.MAILGUN_API_KEY,
    mailgunDomain: process.env.MAILGUN_DOMAIN,
  };
}

/**
 * Envia e-mail via o provedor configurado. Retorna { ok, error }.
 * Se nenhum provedor estiver configurado, não envia e retorna { ok: true } (evita quebrar o fluxo).
 */
export async function sendEmail({ to, subject, html, text }) {
  const cfg = getConfig();
  if (!cfg.provider) {
    return { ok: true, skipped: true };
  }

  const toAddress = Array.isArray(to) ? to[0] : to;
  if (!toAddress) return { ok: false, error: "Destinatário ausente" };

  try {
    if (cfg.provider === "resend" && cfg.resendKey) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.resendKey}`,
        },
        body: JSON.stringify({
          from: cfg.from,
          to: [toAddress],
          subject,
          html: html || undefined,
          text: text || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: data.message || data.error || `HTTP ${res.status}` };
      }
      return { ok: true, id: data.id };
    }

    if (cfg.provider === "sendgrid" && cfg.sendgridKey) {
      const content = [];
      if (html) content.push({ type: "text/html", value: html });
      if (text) content.push({ type: "text/plain", value: text });
      if (!content.length) content.push({ type: "text/plain", value: subject });
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.sendgridKey}`,
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: toAddress }] }],
          from: { email: cfg.fromEmail, name: cfg.fromName },
          subject,
          content,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: data.errors?.[0]?.message || `HTTP ${res.status}` };
      }
      return { ok: true };
    }

    if (cfg.provider === "mailgun" && cfg.mailgunKey && cfg.mailgunDomain) {
      const form = new FormData();
      form.append("from", cfg.from);
      form.append("to", toAddress);
      form.append("subject", subject);
      if (html) form.append("html", html);
      if (text) form.append("text", text);
      const res = await fetch(`https://api.mailgun.net/v3/${cfg.mailgunDomain}/messages`, {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`api:${cfg.mailgunKey}`).toString("base64"),
        },
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: data.message || `HTTP ${res.status}` };
      }
      return { ok: true };
    }

    return { ok: true, skipped: true };
  } catch (err) {
    return { ok: false, error: err.message || "Erro ao enviar e-mail" };
  }
}

/**
 * Envio: Nova oferta recebida (valor líquido já calculado).
 */
export async function sendNovaOfertaEmail({ to, valorLiquido, companyName }) {
  const html = getNovaOfertaHtml(valorLiquido, companyName);
  return sendEmail({
    to,
    subject: "Nova oferta recebida no ConeXai",
    html,
  });
}

/**
 * Envio: Venda concluída (valor creditado no influencer_credits_balance).
 */
export async function sendVendaConcluidaEmail({ to, valorCreditado, companyName }) {
  const html = getVendaConcluidaHtml(valorCreditado, companyName);
  return sendEmail({
    to,
    subject: "Venda concluída — saldo atualizado | ConeXai",
    html,
  });
}
