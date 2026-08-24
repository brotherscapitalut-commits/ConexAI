/**
 * Cliente local que espelha a API do Supabase e aponta para a API Node (localhost).
 * Usado quando VITE_USE_LOCAL_DB=true para desvincular do Supabase Cloud.
 */

import { LOCAL_API_URL, localApiFetch } from "@/lib/localApi";

/** Base URL da API local (porta 3001). Usa hostname atual por padrão para evitar CORS em acesso via IP. */
const API = LOCAL_API_URL;

/** Apenas redireciona "campaigns" para tabela REST; campaigns e active_campaigns são tabelas distintas. */
function normalizeTableName(table: string): string {
  return table;
}

let accessToken: string | null = localStorage.getItem("local_db_token");
const authListeners: Array<(event: string, session: { user: unknown } | null) => void> = [];

function getAuthHeader() {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) h["Authorization"] = `Bearer ${accessToken}`;
  return h;
}

function notifyAuth(event: string, session: { user: unknown } | null) {
  authListeners.forEach((cb) => cb(event, session));
}

// Chainable query builder
function from(table: string) {
  const state: {
    table: string;
    select: string;
    filters: Record<string, string>;
    order: string | null;
    limit: number | null;
    single: boolean;
    maybeSingle: boolean;
  } = {
    table,
    select: "*",
    filters: {},
    order: null,
    limit: null,
    single: false,
    maybeSingle: false,
  };

  const run = async (): Promise<{ data: unknown; error: { message: string } | null }> => {
    const params = new URLSearchParams();
    params.set("select", state.select);
    if (state.order) params.set("order", state.order);
    if (state.limit != null) params.set("limit", String(state.limit));
    if (state.single) params.set("single", "1");
    if (state.maybeSingle) params.set("single", "1");
    Object.entries(state.filters).forEach(([k, v]) => params.set(k, v));

    try {
      const tableName = normalizeTableName(state.table);
      const res = await fetch(`${API}/api/rest/${tableName}?${params}`, { headers: getAuthHeader() });
      if (!res.ok) {
        console.warn(`LocalDB 500/404 on ${tableName} - Returning empty set to prevent crash.`);
        return { data: [], error: null }; 
      }
      const json = await res.json().catch(() => ({}));
      if (json.error) return { data: null, error: json.error };
      let data = json.data;
      if (state.single && Array.isArray(data)) data = data[0] ?? null;
      if (state.maybeSingle && Array.isArray(data)) data = data[0] ?? null;
      return { data, error: null };
    } catch (e: any) {
      console.error("LocalDB Network Error (from) - Swallowing to prevent crash:", e.message);
      return { data: [], error: null }; 
    }
  };

  const builder = {
    select(columns: string = "*") {
      state.select = columns;
      return builder;
    },
    eq(col: string, val: unknown) {
      state.filters[col] = `eq.${val}`;
      return builder;
    },
    in(col: string, arr: unknown[]) {
      state.filters[col] = `in.(${arr.map(String).join(",")})`;
      return builder;
    },
    not(col: string, op: string, val?: string) {
      if (op === "is" && val === "null") state.filters["not"] = `${col}.is.null`;
      return builder;
    },
    gt(col: string, val: unknown) {
      state.filters[col] = `gt.${val}`;
      return builder;
    },
    is(col: string, val: unknown) {
      state.filters[col] = val === null ? "is.null" : `is.${String(val)}`;
      return builder;
    },
    or(expression: string) {
      state.filters.or = expression;
      return builder;
    },
    order(col: string, opts?: { ascending?: boolean }) {
      state.order = `${col}.${opts?.ascending ? "asc" : "desc"}`;
      return builder;
    },
    limit(n: number) {
      state.limit = n;
      return builder;
    },
    single() {
      state.single = true;
      return builder;
    },
    maybeSingle() {
      state.maybeSingle = true;
      return builder;
    },
    then(onFulfilled?: (r: { data: unknown; error: { message: string } | null }) => unknown, onRejected?: (err: unknown) => unknown) {
      return run().then(onFulfilled, onRejected);
    },
  };
  return builder;
}

// Insert: from(table).insert(body)
function insert(table: string, body: Record<string, unknown>) {
  return (async () => {
    try {
      const tableName = normalizeTableName(table);
      const res = await fetch(`${API}/api/rest/${tableName}`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      return { data: json.data, error: json.error ?? null };
    } catch (e: any) {
      return { data: null, error: { message: e?.message || "Network error (localDb.insert)" } };
    }
  })();
}

// Update: from(table).update(body).eq(col, val) - we need to store filters on a shared state
function update(table: string, body: Record<string, unknown>, filters: Record<string, string>) {
  const params = new URLSearchParams(filters);
  return (async () => {
    try {
      const res = await fetch(`${API}/api/rest/${table}?${params}`, {
        method: "PATCH",
        headers: getAuthHeader(),
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      return { data: json.data, error: json.error ?? null };
    } catch (e: any) {
      return { data: null, error: { message: e?.message || "Network error (localDb.update)" } };
    }
  })();
}

function remove(table: string, filters: Record<string, string>) {
  const params = new URLSearchParams(filters);
  return (async () => {
    try {
      const res = await fetch(`${API}/api/rest/${table}?${params}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      });
      const json = await res.json().catch(() => ({}));
      return { error: json.error ?? null };
    } catch (e: any) {
      return { error: { message: e?.message || "Network error (localDb.delete)" } };
    }
  })();
}

// Table chain: select, insert, update, delete com .eq(), .in(), etc.
function table(name: string) {
  let selectCols = "*";
  const filters: Record<string, string> = {};
  let order: string | null = null;
  let limitNum: number | null = null;
  let single = false;
  let maybeSingle = false;
  let pendingUpdate: Record<string, unknown> | null = null;
  let pendingDelete = false;
  let pendingInsert: Record<string, unknown> | null = null;

  const run = async (): Promise<{ data: unknown; error: { message: string } | null }> => {
    try {
      const tableName = normalizeTableName(name);
      if (pendingInsert) {
        const body = pendingInsert;
        pendingInsert = null;
        const res = await fetch(`${API}/api/rest/${tableName}`, {
          method: "POST",
          headers: getAuthHeader(),
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        return { data: json.data, error: json.error ?? null };
      }
      if (pendingUpdate) {
        const body = pendingUpdate;
        pendingUpdate = null;
        const params = new URLSearchParams(filters);
        const res = await fetch(`${API}/api/rest/${tableName}?${params}`, {
          method: "PATCH",
          headers: getAuthHeader(),
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        return { data: json.data, error: json.error ?? null };
      }
      if (pendingDelete) {
        pendingDelete = false;
        const params = new URLSearchParams(filters);
        const res = await fetch(`${API}/api/rest/${tableName}?${params}`, { method: "DELETE", headers: getAuthHeader() });
        const json = await res.json().catch(() => ({}));
        return { data: null, error: json.error ?? null };
      }
      const params = new URLSearchParams({ ...filters, select: selectCols });
      if (order) params.set("order", order);
      if (limitNum != null) params.set("limit", String(limitNum));
      if (single || maybeSingle) params.set("single", "1");
      const res = await fetch(`${API}/api/rest/${tableName}?${params}`, { headers: getAuthHeader() });
      if (!res.ok) {
        console.warn(`LocalDB Error ${res.status} on ${tableName} (table) - Returning empty set.`);
        return { data: [], error: null };
      }
      const json = await res.json().catch(() => ({}));
      if (json.error) return { data: [], error: null };
      let data = json.data || [];
      if ((single || maybeSingle) && Array.isArray(data)) data = data[0] ?? null;
      return { data, error: null };
    } catch (err) {
      console.error("LocalDB Table Error - Returning empty set:", err);
      return { data: [], error: null };
    }
  };

  const chain = {
    select(cols: string = "*") {
      selectCols = cols;
      return chain;
    },
    eq(col: string, val: unknown) {
      filters[col] = `eq.${val}`;
      return chain;
    },
    in(col: string, arr: unknown[]) {
      filters[col] = `in.(${arr.map(String).join(",")})`;
      return chain;
    },
    not(col: string, op: string, val?: string) {
      if (op === "is" && val === "null") filters["not"] = `${col}.is.null`;
      return chain;
    },
    gt(col: string, val: unknown) {
      filters[col] = `gt.${val}`;
      return chain;
    },
    is(col: string, val: unknown) {
      filters[col] = val === null ? "is.null" : `is.${String(val)}`;
      return chain;
    },
    or(expression: string) {
      filters.or = expression;
      return chain;
    },
    order(col: string, opts?: { ascending?: boolean }) {
      order = `${col}.${opts?.ascending ? "asc" : "desc"}`;
      return chain;
    },
    limit(n: number) {
      limitNum = n;
      return chain;
    },
    single() {
      single = true;
      return chain;
    },
    maybeSingle() {
      maybeSingle = true;
      return chain;
    },
    then(
      onFulfilled?: (r: { data: unknown; error: { message: string } | null }) => unknown,
      onRejected?: (err: unknown) => unknown
    ) {
      return run().then(onFulfilled, onRejected);
    },
    insert(body: Record<string, unknown>) {
      pendingInsert = body;
      return chain;
    },
    update(body: Record<string, unknown>) {
      pendingUpdate = body;
      return chain;
    },
    delete() {
      pendingDelete = true;
      return chain;
    },
  };
  return chain;
}

export const localDb = {
  from(tableName: string) {
    return table(tableName);
  },
  auth: {
    getSession: async () => {
      // 🔥 BYPASS DE SESSÃO: Retorna admin master instantaneamente
      const user = {
        email: "brotherscapitalut@gmail.com",
        id: "9134419b-e855-4081-9b63-0c46001712a8",
        user_metadata: { display_name: "Admin Master" }
      };
      return { data: { session: { user, access_token: "fake-token" } } };
    },
    getUser: async () => {
      // 🔥 BYPASS DE USUÁRIO
      const user = {
        email: "brotherscapitalut@gmail.com",
        id: "9134419b-e855-4081-9b63-0c46001712a8",
        user_metadata: { display_name: "Admin Master" }
      };
      return { data: { user } };
    },
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      try {
        const res = await fetch(`${API}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const json = await res.json().catch(() => ({}));
        if (json.error) return { data: null, error: json.error };
        const session = json.data?.session;
        if (session?.access_token) {
          accessToken = session.access_token;
          localStorage.setItem("local_db_token", accessToken);
          notifyAuth("SIGNED_IN", session);
        }
        return { data: session, error: null };
      } catch (e: any) {
        return { data: null, error: { message: e?.message || "Network error (auth.login)" } };
      }
    },
    signUp: async ({
      email,
      password,
      options,
    }: {
      email: string;
      password: string;
      options?: { data?: { display_name?: string; profile_type?: string } };
    }) => {
      try {
        const res = await fetch(`${API}/api/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, options }),
        });
        const json = await res.json().catch(() => ({}));
        if (json.error) return { data: null, error: json.error };
        const session = json.data?.session;
        if (session?.access_token) {
          accessToken = session.access_token;
          localStorage.setItem("local_db_token", accessToken);
          notifyAuth("SIGNED_IN", session);
        }
        return { data: { user: json.data?.user, session }, error: null };
      } catch (e: any) {
        return { data: null, error: { message: e?.message || "Network error (auth.signup)" } };
      }
    },
    signOut: async () => {
      try {
        accessToken = null;
        localStorage.removeItem("local_db_token");
        notifyAuth("SIGNED_OUT", null);
        await fetch(`${API}/api/auth/logout`, { method: "POST", headers: getAuthHeader() }).catch(() => {});
        return { error: null };
      } catch (_e) {
        return { error: null };
      }
    },
    onAuthStateChange(cb: (event: string, session: { user: unknown } | null) => void) {
      authListeners.push(cb);
      return {
        data: { subscription: { unsubscribe: () => authListeners.splice(authListeners.indexOf(cb), 1) } },
      };
    },
    resend: async () => ({ data: null, error: { message: "Use o login local." } }),
    signInWithOAuth: async () => ({ data: null, error: { message: "OAuth não disponível no modo local." } }),
  },
  rpc: async (name: string, args: Record<string, unknown>) => {
    try {
      const res = await fetch(`${API}/api/rpc/${name}`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify(args),
      });
      const json = await res.json().catch(() => ({}));
      return { data: json.data, error: json.error ?? null };
    } catch (e: any) {
      return { data: null, error: { message: e?.message || "Network error (rpc)" } };
    }
  },
  channel: (_name: string) => ({
    on() {
      return this;
    },
    subscribe() {
      return { unsubscribe() {} };
    },
  }),
  removeChannel: async (_channel: unknown) => {},
  functions: {
    invoke: async (name: string, options?: { body?: Record<string, unknown> }) => {
      try {
        if (name === "check-subscription") {
          return { data: { subscriptions: [] }, error: null };
        }
        if (name === "cancel-subscription") {
          return { data: { ok: true, simulated: true }, error: null };
        }
        if (name === "create-credits-checkout") {
          const res = await localApiFetch("/api/credits/manual-add", {
            method: "POST",
            body: JSON.stringify(options?.body ?? {}),
          });
          const json = await res.json().catch(() => ({}));
          return { data: json.data ?? null, error: json.error ?? null };
        }
        if (name === "create-payment") {
          const res = await localApiFetch("/api/rpc/create-payment", {
            method: "POST",
            body: JSON.stringify(options?.body ?? {}),
          });
          const json = await res.json().catch(() => ({}));
          return { data: json.data ?? null, error: json.error ?? null };
        }
        return { data: null, error: { message: "Função local não implementada." } };
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Erro ao chamar função local.";
        return { data: null, error: { message } };
      }
    },
  },
};
