import { pool } from "./db.js";

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * params sempre como array; undefined/null vira [].
 */
function normalizeParams(params) {
  if (params == null) return [];
  return Array.isArray(params) ? params : [];
}

/**
 * ÚNICO ponto que executa SELECT/INSERT/UPDATE/DELETE com client.query neste ficheiro.
 * Nunca chame client.query(sql, params) diretamente nas funções exportadas — use isto.
 * - params vazio ou ausente → client.query(sql) (evita modo parametrizado com []).
 * - params com elementos → client.query(sql, params).
 * Exceção: setSessionUserId (SET LOCAL).
 */
function runQuery(client, sql, params) {
  const p = normalizeParams(params);
  if (p.length > 0) {
    return client.query(sql, p);
  }
  return client.query(sql);
}

/** Sessão RLS: único outro client.query permitido (SET LOCAL com $1). */
function setSessionUserId(client, userId) {
  if (!userId) return Promise.resolve();
  return client.query("SET LOCAL app.current_user_id = $1", [userId]);
}

/** Monta string SQL legível para log (substitui $1..$n pelos valores; só para debug). */
function formatSqlForLog(sql, params) {
  if (!params || params.length === 0) return sql;
  let out = sql;
  for (let i = params.length; i >= 1; i--) {
    const val = params[i - 1];
    const safeVal =
      val === null || val === undefined
        ? "NULL"
        : typeof val === "string"
          ? `'${String(val).replace(/'/g, "''")}'`
          : typeof val === "object"
            ? `'${JSON.stringify(val).replace(/'/g, "''")}'`
            : String(val);
    out = out.replace(new RegExp(`\\$${i}(?!\\d)`, "g"), safeVal);
  }
  return out;
}

/** Valor escapado para SQL literal (strings, números simples, booleanos). */
function sqlValueLiteral(val) {
  const s = String(val);
  if (s === "null" || s === "NULL") return "NULL";
  if (s === "true" || s === "TRUE") return "TRUE";
  if (s === "false" || s === "FALSE") return "FALSE";
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)) return s;
  return `'${s.replace(/'/g, "''")}'`;
}

/**
 * Converte um filtro estilo Supabase (query string) em fragmento SQL com literais,
 * sem placeholders ($1, $2).
 */
function filterToLiteralSql(safeCol, raw) {
  if (raw === "") return null;

  if (raw.startsWith("ilike.")) {
    return `${safeCol} ILIKE ${sqlValueLiteral(raw.slice(6))}`;
  }
  if (raw.startsWith("like.")) {
    return `${safeCol} LIKE ${sqlValueLiteral(raw.slice(5))}`;
  }
  if (raw.startsWith("gte.")) {
    return `${safeCol} >= ${sqlValueLiteral(raw.slice(4))}`;
  }
  if (raw.startsWith("lte.")) {
    return `${safeCol} <= ${sqlValueLiteral(raw.slice(4))}`;
  }
  if (raw.startsWith("neq.")) {
    return `${safeCol} <> ${sqlValueLiteral(raw.slice(4))}`;
  }
  if (raw.startsWith("eq.")) {
    return `${safeCol} = ${sqlValueLiteral(raw.slice(3))}`;
  }
  if (raw.startsWith("gt.")) {
    return `${safeCol} > ${sqlValueLiteral(raw.slice(3))}`;
  }
  if (raw.startsWith("lt.")) {
    return `${safeCol} < ${sqlValueLiteral(raw.slice(3))}`;
  }
  if (raw.startsWith("in.(") && raw.endsWith(")")) {
    const inner = raw.slice(4, -1);
    const parts = inner.split(",").map((p) => p.trim()).filter(Boolean);
    if (!parts.length) return null;
    const list = parts.map((p) => sqlValueLiteral(p)).join(", ");
    return `${safeCol} IN (${list})`;
  }
  if (raw === "is.null") {
    return `${safeCol} IS NULL`;
  }
  if (raw === "is.true") {
    return `${safeCol} IS TRUE`;
  }
  if (raw === "is.false") {
    return `${safeCol} IS FALSE`;
  }
  if (raw === "is.not.null") {
    return `${safeCol} IS NOT NULL`;
  }
  if (raw.startsWith("is.")) {
    const rest = raw.slice(3);
    if (rest === "null") return `${safeCol} IS NULL`;
    if (rest === "not.null") return `${safeCol} IS NOT NULL`;
    if (rest === "true") return `${safeCol} IS TRUE`;
    if (rest === "false") return `${safeCol} IS FALSE`;
  }

  return `${safeCol} = ${sqlValueLiteral(raw)}`;
}

function splitTopLevel(input) {
  const parts = [];
  let current = "";
  let depth = 0;
  for (const ch of String(input || "")) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseOrExpression(raw) {
  const parts = splitTopLevel(raw);
  const fragments = [];
  for (const part of parts) {
    const match = part.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)\.(.*)$/);
    if (!match) continue;
    const [, col, op, value] = match;
    const safeCol = `"${col.replace(/"/g, '""')}"`;
    const frag = filterToLiteralSql(safeCol, `${op}.${value}`);
    if (frag) fragments.push(frag);
  }
  return fragments.length > 0 ? `(${fragments.join(" OR ")})` : null;
}

/** Nomes de tabela/coluna REST (evita injeção via path ou query). */
export function assertSafeTable(table) {
  if (typeof table !== "string" || !IDENT.test(table)) {
    throw new Error("Nome de tabela inválido");
  }
}

function safeSelect(sel) {
  const s = (sel || "*").trim();
  if (s === "*") return "*";

  // Support `*,col1,col2` (Supabase style: all columns + specific extras)
  // e.g. select=*,+purchase_price,+position_id → SELECT *, purchase_price, position_id
  const parts = s.split(",").map((p) => p.trim().replace(/^\+/, "")).filter(Boolean);

  let hasStar = false;
  const cols = [];
  for (const p of parts) {
    if (p === "*") {
      hasStar = true;
      continue;
    }
    if (!IDENT.test(p)) throw new Error("Lista de colunas inválida");
    cols.push(`"${p.replace(/"/g, '""')}"`);
  }

  if (hasStar) {
    // `*, col1, col2` — return all columns plus specific ones
    if (cols.length > 0) return `*, ${cols.join(", ")}`;
    return "*";
  }
  return cols.join(", ");
}

function parseQuery(query) {
  const table = query._table;
  assertSafeTable(table);
  const select = safeSelect(query.select);
  let sql = `SELECT ${select} FROM public.${table}`;
  const params = [];
  const filters = [];
  Object.entries(query).forEach(([key, value]) => {
    if (["order", "limit", "single", "select", "_table"].includes(key)) return;
    if (!IDENT.test(key)) return;
    const raw = value != null ? String(value) : "";
    if (raw === "") return;

    const safeCol = `"${key.replace(/"/g, '""')}"`;

    if (key === "or") {
      const frag = parseOrExpression(raw);
      if (frag) filters.push(frag);
      return;
    }

    if (key === "not" && raw === "owner_id.is.null") {
      filters.push(`"owner_id" IS NOT NULL`);
      return;
    }

    const frag = filterToLiteralSql(safeCol, raw);
    if (frag) filters.push(frag);
  });

  if (filters.length > 0) {
    sql += " WHERE " + filters.join(" AND ");
  }

  const order = query.order || "";
  const limit = query.limit ? parseInt(query.limit, 10) : null;
  const single = query.single === "1" || query.single === "true";

  if (order) {
    const [col, dirRaw] = order.split(".");
    if (!IDENT.test(col)) throw new Error("Coluna ORDER BY inválida");
    const dir = dirRaw === "asc" ? "ASC" : "DESC";
    sql += ` ORDER BY "${col.replace(/"/g, '""')}" ${dir}`;
  }
  if (limit) sql += ` LIMIT ${Math.min(limit, 1000)}`;

  return { sql, params, single };
}

export async function restGet(table, query, userId) {
  const q = { ...query, _table: table };
  let { sql, params, single } = parseQuery(q);
  const queryParams = normalizeParams(params);
  sql = sql.trim();
  console.log(`[rest] SQL: ${formatSqlForLog(sql, queryParams)}`);

  const client = await pool.connect();
  try {
    await setSessionUserId(client, userId);

    const result = await runQuery(client, sql, queryParams);
    const data = single ? result.rows[0] ?? null : result.rows;
    return { data, error: null };
  } catch (err) {
    console.error("[restGet]", err.message);
    throw err;
  } finally {
    client.release();
  }
}

export async function restPost(table, body, userId) {
  assertSafeTable(table);
  const client = await pool.connect();
  try {
    await setSessionUserId(client, userId);

    // Bloqueio específico para partnership_proposals com ID inválido
    if (table === "partnership_proposals") {
      const toCompany = body.to_company_id;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (typeof toCompany !== "string" || !uuidRegex.test(toCompany)) {
        return {
          data: null,
          error: { message: "ID de empresa inválido. Selecione uma empresa real do banco." },
        };
      }
    }

    const keys = Object.keys(body).filter((k) => body[k] !== undefined && IDENT.test(k));
    if (!keys.length) {
      return { data: null, error: { message: "Nenhum campo válido para inserir" } };
    }

    const cols = keys.map((c) => `"${c.replace(/"/g, '""')}"`).join(", ");
    const values = keys.map((k) => body[k]);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");

    const sql = `INSERT INTO public.${table} (${cols}) VALUES (${placeholders}) RETURNING *`;
    const queryParams = normalizeParams(values);
    console.log(`[rest] SQL: ${formatSqlForLog(sql, queryParams)}`);
    const result = await runQuery(client, sql, queryParams);
    return { data: result.rows[0], error: null };
  } catch (err) {
    console.error("[restPost]", err.message);
    throw err;
  } finally {
    client.release();
  }
}

/** WHERE a partir da query string: apenas literais, sem placeholders. */
function buildWhereLiteral(query) {
  const where = [];
  for (const [key, value] of Object.entries(query)) {
    if (key.startsWith("_") || value == null || value === "") continue;
    if (!IDENT.test(key)) continue;
    const str = String(value);
    const qcol = `"${key.replace(/"/g, '""')}"`;

    if (key === "or") {
      const frag = parseOrExpression(str);
      if (frag) where.push(frag);
      continue;
    }

    if (key === "not" && str === "owner_id.is.null") {
      where.push(`"owner_id" IS NOT NULL`);
      continue;
    }

    const frag = filterToLiteralSql(qcol, str);
    if (frag) where.push(frag);
  }
  return where;
}

export async function restPatch(table, body, query, userId) {
  assertSafeTable(table);
  const keys = Object.keys(body).filter((k) => body[k] !== undefined && IDENT.test(k));
  if (!keys.length) return { data: null, error: { message: "Nenhum campo para atualizar" } };
  const where = buildWhereLiteral(query);
  if (!where.length) return { data: null, error: { message: "Filtro obrigatório para UPDATE" } };
  const setClause = keys
    .map((k, i) => `"${k.replace(/"/g, '""')}" = $${i + 1}`)
    .join(", ");
  const values = keys.map((k) => body[k]);
  const sql = `UPDATE public.${table} SET ${setClause} WHERE ${where.join(" AND ")} RETURNING *`;
  const queryParams = normalizeParams(values);
  console.log(`[rest] SQL: ${formatSqlForLog(sql, queryParams)}`);
  const client = await pool.connect();
  try {
    await setSessionUserId(client, userId);
    const result = await runQuery(client, sql, queryParams);
    return { data: result.rows[0] ?? result.rows, error: null };
  } catch (err) {
    console.error("[restPatch] SQL error:", err);
    return { data: null, error: { message: err.message } };
  } finally {
    client.release();
  }
}

export async function restDelete(table, query, userId) {
  assertSafeTable(table);
  const where = buildWhereLiteral(query);
  if (!where.length) return { error: { message: "Filtro obrigatório para DELETE" } };
  const sql = `DELETE FROM public.${table} WHERE ${where.join(" AND ")}`;
  const queryParams = [];
  console.log(`[rest] SQL: ${formatSqlForLog(sql, queryParams)}`);
  const client = await pool.connect();
  try {
    await setSessionUserId(client, userId);
    await runQuery(client, sql, queryParams);
    return { error: null };
  } catch (err) {
    console.error("[restDelete] SQL error:", err);
    return { error: { message: err.message } };
  } finally {
    client.release();
  }
}
