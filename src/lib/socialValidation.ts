/**
 * Normalize Instagram input to username only (for storage and building instagram.com/username).
 * Accepts: @user, user, https://instagram.com/user, https://www.instagram.com/user/
 */
export function normalizeInstagram(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  let user = trimmed
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\/?/i, "")
    .replace(/\/.*$/, "")
    .trim();
  return user;
}

/** Instagram username: letters, numbers, dots, underscores; 1–30 chars */
export function isValidInstagramUsername(username: string): boolean {
  if (!username || username.length > 30) return false;
  return /^[a-zA-Z0-9._]+$/.test(username);
}

export function normalizeTiktok(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.replace(/^@/, "").replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/i, "").replace(/\/.*$/, "").trim();
}

export function normalizeYoutube(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^@[\w.-]+$/i.test(trimmed)) return `https://youtube.com/${trimmed}`;
  if (/^[\w.-]+$/i.test(trimmed)) return `https://youtube.com/@${trimmed}`;
  return trimmed;
}
