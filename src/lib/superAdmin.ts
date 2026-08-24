/**
 * Super-admin de testes / operação: acesso total (admin + fluxos de empresa no mural).
 * Inclui variações de digitação do e-mail.
 */
export const SUPER_ADMIN_EMAILS = [
  "brotherescapitalut@gamil.com",
  "brotherescapitalut@gmail.com",
  "brotherscapitalut@gmail.com",
] as const;

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const n = email.trim().toLowerCase();
  return (SUPER_ADMIN_EMAILS as readonly string[]).includes(n);
}

/** Quem pode iniciar conversa no mural (marca, influenciador ou admin). */
export function canUseBrandMessaging(args: {
  profileType: "admin" | "company" | "influencer" | "user" | null;
  email: string | null | undefined;
  hasAdminRole: boolean;
  hasSuperAdminRole: boolean;
}): boolean {
  const { profileType, email, hasAdminRole, hasSuperAdminRole } = args;
  if (profileType === "company" || profileType === "influencer") return true;
  if (isSuperAdminEmail(email)) return true;
  if (hasAdminRole || hasSuperAdminRole) return true;
  return false;
}
