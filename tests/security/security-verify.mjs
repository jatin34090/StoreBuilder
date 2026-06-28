#!/usr/bin/env node
/**
 * Security verification test suite.
 * Checks: rate limiting, auth boundaries, CORS, security headers,
 *         error message exposure, file upload restrictions.
 *
 * Usage:
 *   node tests/security/security-verify.mjs
 *
 * Env:
 *   API_BASE   default http://localhost:3001/api/v1
 *   WEB_BASE   default http://localhost:3000
 */
import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';

const API = process.env.API_BASE ?? 'http://localhost:3001/api/v1';
const WEB = process.env.WEB_BASE ?? 'http://localhost:3000';

function rq(url, { method = 'GET', body, headers: extra = {} } = {}) {
  return new Promise((resolve) => {
    const u    = new URL(url);
    const data = body ? JSON.stringify(body) : null;
    const mod  = u.protocol === 'https:' ? https : http;
    const headers = { 'Content-Type': 'application/json', ...extra };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const req = mod.request(
      { hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search, method, headers },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try { resolve({ s: res.statusCode, h: res.headers, b: JSON.parse(raw), raw }); }
          catch { resolve({ s: res.statusCode, h: res.headers, b: null, raw }); }
        });
      },
    );
    req.on('error', (e) => resolve({ s: 0, h: {}, b: null, raw: '', err: e.message }));
    if (data) req.write(data);
    req.end();
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const pass = (n, note = '') => { results.push({ n, ok: true });  console.log(`  ✅  ${n}${note ? '  (' + note + ')' : ''}`); };
const fail = (n, note = '') => { results.push({ n, ok: false }); console.error(`  ❌  ${n}${note ? '  (' + note + ')' : ''}`); };
const skip = (n, r)         => { results.push({ n, ok: null });  console.log(`  ⏭️   ${n}  — ${r}`); };

async function checkRateLimiting() {
  console.log('\n▶  Rate limiting');
  const N = 120;
  const promises = Array.from({ length: N }, () => rq(`${API}/health/live`));
  const responses = await Promise.all(promises);
  const ok429 = responses.filter((r) => r.s === 429).length;
  ok429 > 0
    ? pass(`Rate limit triggered (${ok429}/${N} → 429)`)
    : fail('Rate limit NOT enforced', `All ${N} requests returned 200`);

  // Auth endpoint should have stricter limit
  const authBurst = Array.from({ length: 25 }, () =>
    rq(`${API}/auth/send-otp`, { method: 'POST', body: { phone: '9999999999' } }),
  );
  const authResponses = await Promise.all(authBurst);
  const auth429 = authResponses.filter((r) => r.s === 429).length;
  auth429 > 0
    ? pass(`Auth rate limit triggered (${auth429}/25 → 429)`)
    : fail('Auth rate limit not enforced', 'Consider stricter limit on /auth/*');

  await sleep(2000); // let rate-limit window partially reset
}

async function checkAuthBoundaries() {
  console.log('\n▶  Authentication & authorisation');

  // No token
  const endpoints = [
    `${API}/orders`,
    `${API}/cart`,
    `${API}/users/addresses`,
    `${API}/agent/profile`,
    `${API}/agent/deliveries`,
    `${API}/admin/stats`,
    `${API}/admin/products`,
  ];
  for (const ep of endpoints) {
    const r = await rq(ep);
    r.s === 401
      ? pass(`No token → 401  (${ep.replace(API, '')})`)
      : fail(`Missing auth on ${ep.replace(API, '')}`, `got ${r.s}`);
  }

  // Fake / malformed JWT
  const bad = await rq(`${API}/orders`, { headers: { Authorization: 'Bearer eyJhbGciOiJSUzI1NiJ9.fake.signature' } });
  bad.s === 401 ? pass('Malformed JWT → 401') : fail('Malformed JWT not rejected', `got ${bad.s}`);

  // Expired token (static expired token fixture — just checks format rejection)
  const expired = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid';
  const expR = await rq(`${API}/orders`, { headers: { Authorization: `Bearer ${expired}` } });
  expR.s === 401 ? pass('Expired/invalid JWT → 401') : fail('Expired JWT not rejected', `got ${expR.s}`);
}

async function checkSecurityHeaders() {
  console.log('\n▶  Security headers');
  const webR = await rq(WEB);
  const h = webR.h ?? {};

  const required = {
    'x-frame-options':        'DENY or SAMEORIGIN',
    'x-content-type-options': 'nosniff',
    'referrer-policy':        'any value',
  };

  for (const [header, desc] of Object.entries(required)) {
    h[header]
      ? pass(`${header}: ${h[header]}`)
      : fail(`Missing ${header}`, desc);
  }

  if (WEB.startsWith('https://')) {
    h['strict-transport-security']
      ? pass(`HSTS: ${h['strict-transport-security']}`)
      : fail('Missing HSTS header');
  } else {
    skip('HSTS', 'WEB_BASE is not HTTPS');
  }
}

async function checkCORS() {
  console.log('\n▶  CORS');
  const allowed = await rq(`${API}/health/live`, {
    headers: { Origin: 'http://localhost:3000', 'Access-Control-Request-Method': 'GET' },
  });
  allowed.h['access-control-allow-origin']
    ? pass(`CORS allows localhost:3000  (${allowed.h['access-control-allow-origin']})`)
    : fail('CORS: allowed origin not returned');

  const blocked = await rq(`${API}/orders`, {
    headers: { Origin: 'https://evil.attacker.com' },
  });
  const acao = blocked.h['access-control-allow-origin'];
  !acao || acao === 'null'
    ? pass('CORS blocks untrusted origin')
    : fail('CORS: untrusted origin allowed', `got ${acao}`);
}

async function checkErrorExposure() {
  console.log('\n▶  Error message exposure');

  // Validation error — should return a clean message, not a stack trace
  const invalid = await rq(`${API}/auth/send-otp`, { method: 'POST', body: { phone: 'not-a-phone' } });
  const body = JSON.stringify(invalid.b ?? invalid.raw ?? '');
  body.includes('Error:') || body.includes('at Object') || body.includes('node_modules')
    ? fail('Stack trace exposed in validation error response')
    : pass('No stack trace in validation error response');

  // 404 — should return JSON, not HTML
  const notFound = await rq(`${API}/this-route-does-not-exist-xyz`);
  notFound.h['content-type']?.includes('application/json')
    ? pass('404 returns JSON (not HTML)')
    : fail('404 returns non-JSON', notFound.h['content-type']);

  // Internal error simulation — POST to checkout without body
  const badCheckout = await rq(`${API}/orders`, { method: 'POST', body: {} });
  const msg = badCheckout.b?.message ?? '';
  !msg.includes('PrismaClientKnownRequestError') && !msg.includes('stack')
    ? pass('DB errors not exposed in API responses')
    : fail('DB error message leaked', msg.slice(0, 80));
}

async function checkAdminIsolation() {
  console.log('\n▶  Admin route isolation');
  const adminRoutes = [
    `${API}/admin/stats`,
    `${API}/admin/users`,
    `${API}/admin/coupons`,
  ];
  for (const ep of adminRoutes) {
    const r = await rq(ep);
    [401, 403].includes(r.s)
      ? pass(`${ep.replace(API, '')} blocked (${r.s})`)
      : fail(`Admin route accessible without auth`, `${ep.replace(API, '')} → ${r.s}`);
  }
}

(async () => {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Security Verification');
  console.log(`  API: ${API}`);
  console.log(`  WEB: ${WEB}`);
  console.log('═══════════════════════════════════════════════════');

  await checkRateLimiting();
  await checkAuthBoundaries();
  await checkSecurityHeaders();
  await checkCORS();
  await checkErrorExposure();
  await checkAdminIsolation();

  const passed  = results.filter((r) => r.ok === true).length;
  const failed  = results.filter((r) => r.ok === false).length;
  const skipped = results.filter((r) => r.ok === null).length;

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  ${passed} passed · ${failed} failed · ${skipped} skipped`);
  console.log('═══════════════════════════════════════════════════\n');

  if (failed > 0) {
    console.error('SECURITY VERIFICATION FAILED — resolve before production.\n');
    process.exit(1);
  }
  console.log('All security checks passed ✅\n');
})();
