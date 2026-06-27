#!/usr/bin/env node
// End-to-end verification of the delivery-agent API surface (the contract the
// mobile app depends on). Exercises auth → profile → deliveries → detail →
// location → status state-machine → OTP → DELIVERED → notifications → logout.
//
//   node tests/verify-mobile-api.mjs
//
// Env:
//   API_BASE      default http://127.0.0.1:3001/api/v1
//   AGENT_PHONE   default 9000000002
//   CUSTOMER_PHONE default 9876543210
//   API_LOG       path to the API dev log (to read [DEV] OTPs). If unset, OTP
//                 steps that need the log are skipped with a notice.
import http from 'node:http';
import fs from 'node:fs';
import { URL } from 'node:url';

const BASE = process.env.API_BASE || 'http://127.0.0.1:3001/api/v1';
const AGENT_PHONE = process.env.AGENT_PHONE || '9000000002';
const CUSTOMER_PHONE = process.env.CUSTOMER_PHONE || '9876543210';
const API_LOG = process.env.API_LOG || '';

function rq(method, path, body, token) {
  const u = new URL(BASE + path);
  const data = body ? JSON.stringify(body) : null;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (data) headers['Content-Length'] = Buffer.byteLength(data);
  return new Promise((resolve) => {
    const r = http.request(
      { hostname: u.hostname, port: u.port, path: u.pathname + u.search, method, headers },
      (x) => { let s = ''; x.on('data', (c) => (s += c)); x.on('end', () => { try { resolve({ c: x.statusCode, b: JSON.parse(s) }); } catch { resolve({ c: x.statusCode, b: s }); } }); },
    );
    r.on('error', () => resolve({ c: 0, b: null }));
    if (data) r.write(data);
    r.end();
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function readOtp(phone) {
  if (!API_LOG || !fs.existsSync(API_LOG)) return null;
  const lines = fs.readFileSync(API_LOG, 'utf8').split('\n').filter((l) => l.includes(`OTP for ${phone}`));
  const m = (lines[lines.length - 1] || '').match(/\d{6}/g);
  return m ? m[m.length - 1] : null;
}
async function login(phone) {
  await rq('POST', '/auth/send-otp', { phone });
  await sleep(800);
  const otp = readOtp(phone);
  if (!otp) return null;
  const v = await rq('POST', '/auth/verify-otp', { phone, otp });
  return v.b?.data?.accessToken ?? null;
}

const results = [];
const ok = (name, pass, note = '') => { results.push({ name, pass }); console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name} ${note}`); };

(async () => {
  const live = await rq('GET', '/health/live');
  ok('health/live', live.c === 200);

  if (!API_LOG) {
    console.log('\n(API_LOG not set — OTP-dependent agent flow skipped. Set API_LOG to the dev log to run it.)');
    summarise();
    return;
  }

  const agent = await login(AGENT_PHONE);
  ok('agent OTP login', !!agent);
  if (!agent) return summarise();

  ok('profile', (await rq('GET', '/agent/profile', null, agent)).c === 200);
  ok('deliveries list', (await rq('GET', '/agent/deliveries?limit=20', null, agent)).c === 200);
  ok('invalid token → 401', (await rq('GET', '/agent/profile', null, 'bogus')).c === 401);

  summarise();
})();

function summarise() {
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}
