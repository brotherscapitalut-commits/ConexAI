export const LOCAL_API_URL = (() => {
  const envUrl = import.meta.env.VITE_LOCAL_API_URL as string | undefined;
  if (envUrl) return envUrl.replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location?.hostname) {
    return `http://${window.location.hostname}:3001`;
  }
  return "http://localhost:3001";
})();

export const PAYMENT_MODE = ((import.meta.env.VITE_PAYMENT_MODE as string | undefined) || "manual").toLowerCase();

export function isManualPaymentMode() {
  return PAYMENT_MODE === "manual" || PAYMENT_MODE === "local";
}

export function getLocalAuthHeaders(extra?: HeadersInit): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = typeof window !== "undefined" ? localStorage.getItem("local_db_token") : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  if (extra instanceof Headers) {
    extra.forEach((value, key) => {
      headers[key] = value;
    });
  } else if (Array.isArray(extra)) {
    extra.forEach(([key, value]) => {
      headers[key] = value;
    });
  } else if (extra) {
    Object.entries(extra).forEach(([key, value]) => {
      headers[key] = String(value);
    });
  }

  return headers;
}

export function localApiUrl(path: string) {
  return `${LOCAL_API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function localApiFetch(path: string, init: RequestInit = {}) {
  return fetch(localApiUrl(path), {
    ...init,
    headers: getLocalAuthHeaders(init.headers),
  });
}

export async function localApiJson<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await localApiFetch(path, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) {
    throw new Error(json?.error?.message || json?.message || `Erro HTTP ${res.status}`);
  }
  return json as T;
}
