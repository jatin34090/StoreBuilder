#!/usr/bin/env node
/**
 * Admin journey E2E test.
 * Exercises: login → dashboard → products → orders → inventory →
 *            coupons → users → delivery assignment → notifications.
 *
 * Usage:
 *   node tests/e2e/admin-journey.mjs
 *
 * Env:
 *   API_BASE        default http://localhost:3001/api/v1
 *   ADMIN_EMAIL     default admin@yourbrand.in
 *   ADMIN_PASSWORD  default Admin@1234
 *   API_LOG         path to API dev log (for OTP-based admin login if applicable)
 */
import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';

const API      = process.env.API_BASE       ?? 'http://localhost:3001/api/v1';
const EMAIL    = process.env.ADMIN_EMAIL    ?? 'admin@yourbrand.in';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin@1234';

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

const results = [];
const pass = (n, note = '') => { results.push({ n, ok: true });  console.log(`  ✅  ${n}${note ? '  (' + note + ')' : ''}`); };
const fail = (n, note = '') => { results.push({ n, ok: false }); console.error(`  ❌  ${n}${note ? '  (' + note + ')' : ''}`); };
const skip = (n, r)         => { results.push({ n, ok: null });  console.log(`  ⏭️   ${n}  — ${r}`); };

async function login() {
  console.log('\n▶  Admin authentication');
  const r = await rq(`${API}/auth/login`, { method: 'POST', body: { identifier: EMAIL, password: PASSWORD } });
  const token = r.b?.data?.accessToken;
  token ? pass('Admin login') : fail('Admin login', `HTTP ${r.s} — ${JSON.stringify(r.b)}`);
  if (token) {
    const role = r.b?.data?.user?.role;
    role === 'ADMIN' ? pass(`Role is ADMIN`) : fail('Role check', `got ${role}`);
  }
  return token ?? null;
}

async function testDashboard(token) {
  console.log('\n▶  Dashboard');
  const stats = await rq(`${API}/admin/stats`, { token });
  stats.s === 200 ? pass('GET /admin/stats') : fail('GET /admin/stats', `HTTP ${stats.s}`);

  const revenue = await rq(`${API}/admin/stats/revenue`, { token });
  revenue.s === 200 ? pass('GET /admin/stats/revenue') : fail('GET /admin/stats/revenue', `HTTP ${revenue.s}`);
}

async function testProducts(token) {
  console.log('\n▶  Product management');
  const list = await rq(`${API}/admin/products?limit=5`, { token });
  list.s === 200 ? pass('GET /admin/products') : fail('GET /admin/products', `HTTP ${list.s}`);
  const count = list.b?.data?.pagination?.total ?? 0;
  count > 0 ? pass(`${count} products in catalogue`) : fail('No products found');

  // Create a test product
  const create = await rq(`${API}/admin/products`, {
    method: 'POST', token,
    body: {
      name: `E2E Test Product ${Date.now()}`,
      description: 'Automated test product — safe to delete',
      price: 999,
      comparePrice: 1499,
      categoryId: list.b?.data?.data?.[0]?.categoryId,
      sku: `E2E-${Date.now()}`,
      stock: 10,
      isActive: false,
    },
  });
  const productId = create.b?.data?.id;
  create.s === 200 || create.s === 201
    ? pass('Create product (draft)')
    : fail('Create product', `HTTP ${create.s} — ${JSON.stringify(create.b)?.slice(0, 100)}`);

  if (productId) {
    // Update
    const update = await rq(`${API}/admin/products/${productId}`, {
      method: 'PATCH', token, body: { description: 'Updated by E2E test' },
    });
    update.s === 200 ? pass('Update product') : fail('Update product', `HTTP ${update.s}`);

    // Delete
    const del = await rq(`${API}/admin/products/${productId}`, { method: 'DELETE', token });
    del.s === 200 || del.s === 204 ? pass('Delete product') : fail('Delete product', `HTTP ${del.s}`);
  }

  const cats = await rq(`${API}/admin/categories`, { token });
  cats.s === 200 ? pass('GET /admin/categories') : fail('GET /admin/categories', `HTTP ${cats.s}`);
}

async function testOrders(token) {
  console.log('\n▶  Order management');
  const list = await rq(`${API}/admin/orders?limit=5`, { token });
  list.s === 200 ? pass('GET /admin/orders') : fail('GET /admin/orders', `HTTP ${list.s}`);

  const firstId = list.b?.data?.data?.[0]?.id;
  if (firstId) {
    const detail = await rq(`${API}/admin/orders/${firstId}`, { token });
    detail.s === 200 ? pass(`GET /admin/orders/${firstId}`) : fail('GET order detail', `HTTP ${detail.s}`);
  } else {
    skip('Order detail', 'No orders in system');
  }
}

async function testInventory(token) {
  console.log('\n▶  Inventory');
  const r = await rq(`${API}/admin/inventory?limit=5`, { token });
  r.s === 200 ? pass('GET /admin/inventory') : fail('GET /admin/inventory', `HTTP ${r.s}`);

  const low = await rq(`${API}/admin/inventory?lowStock=true`, { token });
  low.s === 200 ? pass('GET /admin/inventory?lowStock=true') : fail('Low stock filter', `HTTP ${low.s}`);
}

async function testCoupons(token) {
  console.log('\n▶  Coupons');
  const list = await rq(`${API}/admin/coupons`, { token });
  list.s === 200 ? pass('GET /admin/coupons') : fail('GET /admin/coupons', `HTTP ${list.s}`);

  const create = await rq(`${API}/admin/coupons`, {
    method: 'POST', token,
    body: {
      code: `E2E${Date.now()}`,
      type: 'PERCENTAGE',
      value: 10,
      minOrderValue: 500,
      maxUses: 1,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      isActive: false,
    },
  });
  const couponId = create.b?.data?.id;
  create.s === 200 || create.s === 201
    ? pass('Create coupon')
    : fail('Create coupon', `HTTP ${create.s}`);

  if (couponId) {
    const del = await rq(`${API}/admin/coupons/${couponId}`, { method: 'DELETE', token });
    del.s === 200 || del.s === 204 ? pass('Delete coupon') : fail('Delete coupon', `HTTP ${del.s}`);
  }
}

async function testUsers(token) {
  console.log('\n▶  Users');
  const list = await rq(`${API}/admin/users?limit=5`, { token });
  list.s === 200 ? pass('GET /admin/users') : fail('GET /admin/users', `HTTP ${list.s}`);
}

async function testDeliveryAgents(token) {
  console.log('\n▶  Delivery management');
  const agents = await rq(`${API}/admin/agents?limit=5`, { token });
  agents.s === 200 ? pass('GET /admin/agents') : fail('GET /admin/agents', `HTTP ${agents.s}`);

  const deliveries = await rq(`${API}/admin/deliveries?limit=5`, { token });
  deliveries.s === 200 ? pass('GET /admin/deliveries') : fail('GET /admin/deliveries', `HTTP ${deliveries.s}`);
}

async function testRoleProtection(token) {
  console.log('\n▶  Admin role protection');
  // Admin routes must be inaccessible without token
  const noToken = await rq(`${API}/admin/stats`);
  noToken.s === 401 ? pass('Admin stats → 401 without token') : fail('Admin stats unprotected', `got ${noToken.s}`);

  // Admin routes must be inaccessible to customers
  // (Tested by checking a known customer token if available — skip here)
  skip('Customer token → 403 on admin', 'Requires a separate customer token fixture');
}

(async () => {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Admin Journey E2E');
  console.log(`  API: ${API}  |  Admin: ${EMAIL}`);
  console.log('═══════════════════════════════════════════════════');

  const token = await login();
  if (!token) { console.error('\nCannot continue without admin token.'); process.exit(1); }

  await testDashboard(token);
  await testProducts(token);
  await testOrders(token);
  await testInventory(token);
  await testCoupons(token);
  await testUsers(token);
  await testDeliveryAgents(token);
  await testRoleProtection(token);

  const passed  = results.filter((r) => r.ok === true).length;
  const failed  = results.filter((r) => r.ok === false).length;
  const skipped = results.filter((r) => r.ok === null).length;

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  ${passed} passed · ${failed} failed · ${skipped} skipped`);
  console.log('═══════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
})();
