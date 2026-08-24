#!/usr/bin/env node
/**
 * Teste de carga HTTP contra a API local (Express).
 *
 * Uso:
 *   node scripts/stress/load-test.mjs
 *   STRESS_BASE_URL=http://127.0.0.1:3001 STRESS_CONCURRENCY=50 STRESS_DURATION_MS=10000 node scripts/stress/load-test.mjs
 *
 * Variáveis:
 *   STRESS_BASE_URL   (default: http://localhost:3001)
 *   STRESS_CONCURRENCY (default: 20)
 *   STRESS_DURATION_MS (default: 8000)
 */

const BASE = process.env.STRESS_BASE_URL || "http://localhost:3001";
const CONCURRENCY = Math.max(1, parseInt(process.env.STRESS_CONCURRENCY || "20", 10));
const DURATION_MS = Math.max(500, parseInt(process.env.STRESS_DURATION_MS || "8000", 10));

const endpoints = [
  () => fetch(`${BASE}/api/health`),
  () => fetch(`${BASE}/api/maintenance-mode`),
  () => fetch(`${BASE}/api/rest/blocks?select=id,x,y,status&limit=100&status=eq.occupied`),
  () => fetch(`${BASE}/api/rest/companies?select=id,name&limit=50&moderation_status=eq.approved`),
];

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function oneRequest() {
  const fn = endpoints[Math.floor(Math.random() * endpoints.length)];
  const t0 = performance.now();
  try {
    const res = await fn();
    const ms = performance.now() - t0;
    return { ok: res.ok, status: res.status, ms };
  } catch (e) {
    const ms = performance.now() - t0;
    return { ok: false, status: 0, ms, err: String(e.message || e) };
  }
}

async function worker(stopAt, latencies, errors, counters) {
  while (performance.now() < stopAt) {
    const r = await oneRequest();
    latencies.push(r.ms);
    counters.n++;
    if (!r.ok) errors.push({ status: r.status, err: r.err });
  }
}

async function main() {
  console.log(`[load-test] base=${BASE} concurrency=${CONCURRENCY} duration=${DURATION_MS}ms`);
  const tStart = performance.now();
  const stopAt = tStart + DURATION_MS;
  const latencies = [];
  const errors = [];
  const counters = { n: 0 };

  const workers = Array.from({ length: CONCURRENCY }, () => worker(stopAt, latencies, errors, counters));
  await Promise.all(workers);

  latencies.sort((a, b) => a - b);
  const totalMs = performance.now() - tStart;
  const rps = counters.n / (totalMs / 1000);

  console.log(`[load-test] requests=${counters.n} duration=${totalMs.toFixed(0)}ms rps=${rps.toFixed(1)}`);
  console.log(`[load-test] latency ms — p50=${percentile(latencies, 50).toFixed(1)} p95=${percentile(latencies, 95).toFixed(1)} p99=${percentile(latencies, 99).toFixed(1)} max=${latencies[latencies.length - 1]?.toFixed(1) ?? 0}`);
  if (errors.length) {
    const sample = errors.slice(0, 8);
    console.log(`[load-test] errors (sample ${sample.length}/${errors.length}):`, JSON.stringify(sample));
    process.exitCode = 1;
  } else {
    console.log("[load-test] ok — sem falhas HTTP");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
