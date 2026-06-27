#!/usr/bin/env node
/**
 * Comprehensive staging environment validation.
 * Run against a fully deployed staging stack before promoting to production.
 *
 *   node tests/staging-validate.mjs
 *
 * Env:
 *   API_BASE         default https://api.staging.yourdomain.in/api/v1
 *   WEB_BASE         default https://staging.yourdomain.in
 *   AGENT_PHONE      default 9000000002
 *   API_LOG          path to API log file for reading [DEV] OTPs
 */
import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';
import fs from 'node:fs';

const API = process.env.API_BASE ?? 'https://api.staging.yourdomain.in/api/v1';
const WEB = process.env.WEB_BASE ?? 'https://staging.yourdomain.in';
const AGENT_PHONE = process.env.AGENT_PHONE ?? '9000000002';
const API_LOG = process.env.API_LOG ?? '';

const results = [];
const pass = (name, note = '') => { results.push({ name, ok: true }); console.log(`  ✅  ${name}${note ? '  — ' + note : ''}`); };
const fail = (name, note = '') => { results.push({ name, ok: false }); console.error(`  ❌  ${name}${note ? '  — ' + note : ''}`); };
const skip = (name, reason) => { results.push({ name, ok: null }); console.log(`  ⏭️   ${name}  — SKIPPED: ${reason}`); };

function rq(url, opts = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    const data = opts.body ? JSON.stringify(opts.body) : null;
    const headers = { 'Content-Type': 'application/json', ...(opts.headers ?? {}) };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const req = mod.request(
      { hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: u.pathname + u.search, method: opts.method ?? 'GET', headers },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body), raw: body }); }
          catch { resolve({ status: res.statusCode, headers: res.headers, body: null, raw: body }); }
        });
      },
    );
    req.on('error', (e) => resolve({ status: 0, error: e.message }));
    if (data) req.write(data);
    req.end();
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function readOtp(phone) {
  if (!API_LOG || !fs.existsSync(API_LOG)) return null;
  const lines = fs.readFileSync(API_LOG, 'utf8').split('\n').filter((l) => l.includes(`OTP for ${phone}`));
  const m = (lines[lines.length - 1] ?? '').match(/\d{6}/g);
  return m ? m[m.length - 1] : null;
}

// ─── Sections ─────────────────────────────────────────────────────────────────

async function checkHealth() {
  console.log('\n▶  Health endpoints');

  const live = await rq(`${API}/health/live`);
  live.status === 200 ? pass('GET /health/live') : fail('GET /health/live', `status ${live.status}`);

  const ready = await rq(`${API}/health/ready`);
  ready.status === 200 ? pass('GET /health/ready') : fail('GET /health/ready', `status ${ready.status} — ${JSON.stringify(ready.body)}`);

  const full = await rq(`${API}/health`);
  full.status === 200 ? pass('GET /health (full)') : fail('GET /health (full)', `status ${full.status}`);
  if (full.body?.data) {
    const d = full.body.data;
    d.database === 'ok' ? pass('  db check') : fail('  db check', d.database);
    d.redis ? pass('  redis check') : fail('  redis check', JSON.stringify(d.redis));
  }
}

async function checkSSL() {
  console.log('\n▶  TLS / HTTPS');
  if (!API.startsWith('https://')) { skip('TLS cert', 'API_BASE is not HTTPS — set to production URL'); return; }

  const res = await rq(API.replace('/api/v1', '') + '/api/v1/health/live');
  res.status === 200 ? pass('HTTPS handshake succeeds') : fail('HTTPS handshake', `status ${res.status} / error: ${res.error}`);

  // Check HSTS header via nginx
  const webRes = await rq(WEB);
  webRes.headers?.['strict-transport-security']
    ? pass('HSTS header present')
    : fail('HSTS header missing');
}

async function checkSecurityHeaders() {
  console.log('\n▶  Security headers');
  const res = await rq(WEB);
  const h = res.headers ?? {};
  h['x-frame-options'] ? pass('X-Frame-Options') : fail('X-Frame-Options missing');
  h['x-content-type-options'] ? pass('X-Content-Type-Options') : fail('X-Content-Type-Options missing');
  h['referrer-policy'] ? pass('Referrer-Policy') : fail('Referrer-Policy missing');
}

async function checkPublicAPI() {
  console.log('\n▶  Public API endpoints');

  const products = await rq(`${API}/products?limit=6`);
  products.status === 200 ? pass('GET /products') : fail('GET /products', `status ${products.status}`);

  const search = await rq(`${API}/search?q=ring`);
  search.status === 200 ? pass('GET /search') : fail('GET /search', `status ${search.status}`);

  const cats = await rq(`${API}/categories`);
  cats.status === 200 ? pass('GET /categories') : fail('GET /categories', `status ${cats.status}`);
}

async function checkRateLimit() {
  console.log('\n▶  Rate limiting');
  const burst = 120;
  const promises = Array.from({ length: burst }, () => rq(`${API}/health/live`));
  const responses = await Promise.all(promises);
  const tooMany = responses.filter((r) => r.status === 429).length;
  tooMany > 0
    ? pass(`Rate limit enforced (${tooMany}/${burst} requests got 429)`)
    : fail('Rate limit NOT enforced — all 120 requests returned 200');
}

async function checkAuth() {
  console.log('\n▶  Authentication');

  const noToken = await rq(`${API}/agent/profile`);
  noToken.status === 401 ? pass('Protected route → 401 without token') : fail('Protected route did not return 401', `got ${noToken.status}`);

  const badToken = await rq(`${API}/agent/profile`, { headers: { Authorization: 'Bearer bogus.token.here' } });
  badToken.status === 401 ? pass('Invalid token → 401') : fail('Invalid token did not return 401', `got ${badToken.status}`);

  if (!API_LOG) { skip('Agent OTP login flow', 'API_LOG not set'); return; }

  await rq(`${API}/auth/send-otp`, { method: 'POST', body: { phone: AGENT_PHONE } });
  await sleep(1000);
  const otp = readOtp(AGENT_PHONE);
  if (!otp) { skip('OTP verify', 'Could not read OTP from log'); return; }

  const verify = await rq(`${API}/auth/verify-otp`, { method: 'POST', body: { phone: AGENT_PHONE, otp } });
  const token = verify.body?.data?.accessToken;
  token ? pass('Agent OTP login') : fail('Agent OTP login', `status ${verify.status}`);

  if (token) {
    const profile = await rq(`${API}/agent/profile`, { headers: { Authorization: `Bearer ${token}` } });
    profile.status === 200 ? pass('GET /agent/profile with valid token') : fail('GET /agent/profile', `status ${profile.status}`);

    const deliveries = await rq(`${API}/agent/deliveries?limit=10`, { headers: { Authorization: `Bearer ${token}` } });
    deliveries.status === 200 ? pass('GET /agent/deliveries') : fail('GET /agent/deliveries', `status ${deliveries.status}`);
  }
}

async function checkWebApp() {
  console.log('\n▶  Web application');
  const home = await rq(WEB);
  home.status === 200 ? pass('Homepage loads') : fail('Homepage load failed', `status ${home.status} / error: ${home.error}`);

  const products = await rq(`${WEB}/products`);
  products.status === 200 ? pass('/products page loads') : fail('/products page load failed', `status ${products.status}`);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Staging Validation');
  console.log(`  API: ${API}`);
  console.log(`  WEB: ${WEB}`);
  console.log('═══════════════════════════════════════════════════════');

  await checkHealth();
  await checkSSL();
  await checkSecurityHeaders();
  await checkPublicAPI();
  await checkRateLimit();
  await checkAuth();
  await checkWebApp();

  const passed = results.filter((r) => r.ok === true).length;
  const failed = results.filter((r) => r.ok === false).length;
  const skipped = results.filter((r) => r.ok === null).length;

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed · ${failed} failed · ${skipped} skipped`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (failed > 0) {
    console.error('STAGING VALIDATION FAILED — do not promote to production.\n');
    process.exit(1);
  } else {
    console.log('STAGING VALIDATION PASSED ✅\n');
  }
})();
