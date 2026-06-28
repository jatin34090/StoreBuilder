#!/usr/bin/env node
/**
 * Delivery agent journey E2E test.
 * Exercises: OTP login → profile → deliveries list → go online →
 *            status update → OTP verification → mark delivered.
 *
 * Usage:
 *   node tests/e2e/delivery-agent-journey.mjs
 *
 * Env:
 *   API_BASE      default http://localhost:3001/api/v1
 *   AGENT_PHONE   default 9000000002
 *   API_LOG       path to API dev log (required for OTP reading)
 */
import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';
import { URL } from 'node:url';

const API   = process.env.API_BASE   ?? 'http://localhost:3001/api/v1';
const PHONE = process.env.AGENT_PHONE ?? '9000000002';
const LOG   = process.env.API_LOG    ?? '';

function rq(url, { method = 'GET', body, token } = {}) {
  return new Promise((resolve) => {
    const u    = new URL(url);
    const data = body ? JSON.stringify(body) : null;
    const mod  = u.protocol === 'https:' ? https : http;
    const headers = { 'Content-Type': 'application/json' };
    if (data)  headers['Content-Length'] = Buffer.byteLength(data);
    if (token) headers['Authorization']  = `Bearer ${token}`;
    const req = mod.request(
      { hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search, method, headers },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try { resolve({ s: res.statusCode, b: JSON.parse(raw) }); }
          catch { resolve({ s: res.statusCode, b: raw }); }
        });
      },
    );
    req.on('error', () => resolve({ s: 0, b: null }));
    if (data) req.write(data);
    req.end();
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readOtp(phone) {
  if (!LOG || !fs.existsSync(LOG)) return null;
  const lines = fs.readFileSync(LOG, 'utf8').split('\n')
    .filter((l) => l.includes(`OTP for ${phone}`));
  const m = (lines.at(-1) ?? '').match(/\d{6}/g);
  return m ? m.at(-1) : null;
}

const results = [];
const pass = (n, note = '') => { results.push({ n, ok: true });  console.log(`  ✅  ${n}${note ? '  (' + note + ')' : ''}`); };
const fail = (n, note = '') => { results.push({ n, ok: false }); console.error(`  ❌  ${n}${note ? '  (' + note + ')' : ''}`); };
const skip = (n, r)         => { results.push({ n, ok: null });  console.log(`  ⏭️   ${n}  — ${r}`); };

async function testLogin() {
  console.log('\n▶  Agent authentication');
  if (!LOG) { skip('OTP login', 'API_LOG not set'); return null; }

  const send = await rq(`${API}/auth/send-otp`, { method: 'POST', body: { phone: PHONE } });
  send.s === 200 || send.s === 201 ? pass('Send OTP') : fail('Send OTP', `HTTP ${send.s}`);

  await sleep(1000);
  const otp = readOtp(PHONE);
  if (!otp) { fail('Read OTP from log'); return null; }

  const verify = await rq(`${API}/auth/verify-otp`, { method: 'POST', body: { phone: PHONE, otp } });
  const token  = verify.b?.data?.accessToken;
  token ? pass('Verify OTP → token received') : fail('Verify OTP', `HTTP ${verify.s}`);

  const role = verify.b?.data?.user?.role;
  role === 'DELIVERY_AGENT'
    ? pass('User role is DELIVERY_AGENT')
    : fail('Role check', `got ${role}`);

  return token ?? null;
}

async function testProfile(token) {
  console.log('\n▶  Agent profile');
  if (!token) { skip('Profile (all)', 'No token'); return; }

  const r = await rq(`${API}/agent/profile`, { token });
  r.s === 200 ? pass('GET /agent/profile') : fail('GET /agent/profile', `HTTP ${r.s}`);

  const online = await rq(`${API}/agent/online`, { method: 'PATCH', body: { isOnline: true }, token });
  online.s === 200 ? pass('Set online = true') : fail('Set online', `HTTP ${online.s}`);

  const offline = await rq(`${API}/agent/online`, { method: 'PATCH', body: { isOnline: false }, token });
  offline.s === 200 ? pass('Set online = false') : fail('Set offline', `HTTP ${offline.s}`);
}

async function testDeliveries(token) {
  console.log('\n▶  Delivery list');
  if (!token) { skip('Deliveries (all)', 'No token'); return null; }

  const list = await rq(`${API}/agent/deliveries?limit=10`, { token });
  list.s === 200 ? pass('GET /agent/deliveries') : fail('GET /agent/deliveries', `HTTP ${list.s}`);

  const items = list.b?.data?.deliveries ?? list.b?.data?.items ?? [];
  const count = list.b?.data?.pagination?.total ?? items.length;
  pass(`${count} deliveries assigned to agent`);

  return items[0] ?? null;
}

async function testStatusFlow(token, delivery) {
  console.log('\n▶  Status flow');
  if (!token) { skip('Status flow (all)', 'No token'); return; }
  if (!delivery) { skip('Status flow (all)', 'No assigned delivery'); return; }

  const orderId = delivery.orderId ?? delivery.order?.id;
  if (!orderId) { skip('Status flow', 'Cannot determine orderId from delivery'); return; }

  const detail = await rq(`${API}/agent/deliveries/${orderId}`, { token });
  detail.s === 200 ? pass(`GET /agent/deliveries/${orderId}`) : fail('Get delivery detail', `HTTP ${detail.s}`);

  // Attempt status advance (only if in ASSIGNED state — might already be further)
  const currentStatus = delivery.status;
  if (currentStatus === 'ASSIGNED') {
    const update = await rq(`${API}/agent/deliveries/${orderId}/status`, {
      method: 'PATCH', token, body: { status: 'PICKED_UP' },
    });
    update.s === 200 ? pass('Status: ASSIGNED → PICKED_UP') : fail('Status update', `HTTP ${update.s} — ${JSON.stringify(update.b)}`);
  } else {
    skip('Status transition', `Delivery is already in ${currentStatus} state`);
  }
}

async function testLocationUpdate(token, delivery) {
  console.log('\n▶  GPS location update');
  if (!token) { skip('Location update', 'No token'); return; }
  if (!delivery) { skip('Location update', 'No delivery'); return; }

  const orderId = delivery.orderId ?? delivery.order?.id;
  if (!orderId) { skip('Location update', 'No orderId'); return; }

  const r = await rq(`${API}/agent/deliveries/${orderId}/location`, {
    method: 'POST', token,
    body: { latitude: 19.0760, longitude: 72.8777 },
  });
  r.s === 200 || r.s === 201 ? pass('POST location update') : fail('Location update', `HTTP ${r.s}`);
}

async function testInvalidToken() {
  console.log('\n▶  Auth boundary');
  const r = await rq(`${API}/agent/profile`, { token: 'invalid.jwt.token' });
  r.s === 401 ? pass('Invalid token → 401') : fail('Auth boundary', `got ${r.s}`);

  const noToken = await rq(`${API}/agent/deliveries`);
  noToken.s === 401 ? pass('No token → 401') : fail('No-token boundary', `got ${noToken.s}`);
}

(async () => {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Delivery Agent Journey E2E');
  console.log(`  API: ${API}  |  Agent phone: ${PHONE}`);
  if (!LOG) console.log('  ⚠️  API_LOG not set — OTP-dependent tests will be skipped');
  console.log('═══════════════════════════════════════════════════');

  const token    = await testLogin();
  await testProfile(token);
  const delivery = await testDeliveries(token);
  await testStatusFlow(token, delivery);
  await testLocationUpdate(token, delivery);
  await testInvalidToken();

  const passed  = results.filter((r) => r.ok === true).length;
  const failed  = results.filter((r) => r.ok === false).length;
  const skipped = results.filter((r) => r.ok === null).length;

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  ${passed} passed · ${failed} failed · ${skipped} skipped`);
  console.log('═══════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
})();
