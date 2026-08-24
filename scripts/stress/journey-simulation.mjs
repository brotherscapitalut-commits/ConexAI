#!/usr/bin/env node
/**
 * Simulação sequencial da jornada (API local): saúde → dados públicos → auth opcional → REST autenticado.
 *
 * Uso:
 *   node scripts/stress/journey-simulation.mjs
 *
 * Opcional (para passos após login):
 *   STRESS_EMAIL=marca@test.com STRESS_PASSWORD=senha node scripts/stress/journey-simulation.mjs
 */

const BASE = process.env.STRESS_BASE_URL || "http://localhost:3001";
const EMAIL = process.env.STRESS_EMAIL || "";
const PASSWORD = process.env.STRESS_PASSWORD || "";

async function step(name, fn) {
  process.stdout.write(`  → ${name}... `);
  try {
    const r = await fn();
    console.log(r.ok ? "ok" : `falhou (${r.status})`);
    if (!r.ok && r.body) console.log("    ", JSON.stringify(r.body).slice(0, 200));
    return r;
  } catch (e) {
    console.log("erro:", e.message);
    return { ok: false };
  }
}

async function main() {
  console.log(`[journey] API ${BASE}\n`);

  await step("GET /api/health", async () => {
    const res = await fetch(`${BASE}/api/health`);
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok && body.ok === true, status: res.status, body };
  });

  await step("GET /api/maintenance-mode", async () => {
    const res = await fetch(`${BASE}/api/maintenance-mode`);
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  });

  await step("GET blocks (ocupados, limite 20)", async () => {
    const res = await fetch(
      `${BASE}/api/rest/blocks?select=id,x,y,company_id,status&limit=20&status=eq.occupied`
    );
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok && !body.error, status: res.status, body };
  });

  await step("GET companies (aprovadas, limite 20)", async () => {
    const res = await fetch(
      `${BASE}/api/rest/companies?select=id,name,category&limit=20&moderation_status=eq.approved`
    );
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok && !body.error, status: res.status, body };
  });

  await step("GET partnership_proposals (público sem auth — pode falhar por RLS)", async () => {
    const res = await fetch(`${BASE}/api/rest/partnership_proposals?select=id,status&limit=5`);
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  });

  if (!EMAIL || !PASSWORD) {
    console.log("\n[journey] STRESS_EMAIL / STRESS_PASSWORD não definidos — pulando login e rotas autenticadas.");
    console.log("[journey] Concluído (modo visitante).");
    return;
  }

  let token = null;
  await step("POST /api/auth/login", async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    const body = await res.json().catch(() => ({}));
    token = body?.data?.session?.access_token ?? null;
    return { ok: res.ok && !!token, status: res.status, body };
  });

  if (!token) {
    console.log("\n[journey] Login falhou — interrompendo rotas autenticadas.");
    process.exitCode = 1;
    return;
  }

  const auth = { Authorization: `Bearer ${token}` };

  await step("GET /api/auth/user", async () => {
    const res = await fetch(`${BASE}/api/auth/user`, { headers: auth });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok && body?.data?.user, status: res.status, body };
  });

  await step("GET profiles (autenticado)", async () => {
    const res = await fetch(`${BASE}/api/rest/profiles?select=id,email,profile_type&limit=5`, {
      headers: auth,
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok && !body.error, status: res.status, body };
  });

  await step("GET companies do usuário (autenticado)", async () => {
    const res = await fetch(`${BASE}/api/rest/companies?select=id,name&limit=10`, { headers: auth });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  });

  console.log("\n[journey] Concluído (modo autenticado).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
