/**
 * Log interno do sistema — substitui alert() para erros de API/cache.
 * Em desenvolvimento os erros aparecem no console; em produção pode ser enviado a um serviço.
 */

const isDev = import.meta.env.DEV;

/** Remove referências a "schema cache" e termos técnicos de erro do Supabase para não assustar o usuário. */
function sanitizeMessage(msg: string): string {
  if (typeof msg !== "string") return String(msg);
  return msg
    .replace(/schema\s*cache/gi, "banco de dados")
    .replace(/relation\s+"[^"]*"\s+does not exist/gi, "tabela não encontrada no banco");
}

export const logger = {
  error(context: string, message: string, details?: unknown) {
    const raw = typeof message === "string" ? message : String(message);
    const messageSanitized = sanitizeMessage(raw);
    const payload = details !== undefined ? { message: messageSanitized, details } : { message: messageSanitized };
    console.error(`[${context}]`, payload);
    if (isDev) console.error(`[${context}] ${messageSanitized}`);
  },
  warn(context: string, message: string, details?: unknown) {
    if (details !== undefined) console.warn(`[${context}]`, message, details);
    else console.warn(`[${context}]`, message);
  },
  info(context: string, message: string, details?: unknown) {
    if (details !== undefined) console.info(`[${context}]`, message, details);
    else console.info(`[${context}]`, message);
  },
};
