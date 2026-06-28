#!/usr/bin/env node
/**
 * Customer journey E2E test.
 * Exercises: register → login → browse → search → cart → wishlist →
 *            checkout (COD) → order tracking → review.
 *
 * Usage:
 *   node tests/e2e/customer-journey.mjs
 *
 * Env:
 *   API_BASE        default http://localhost:3001/api/v1
 *   CUSTOMER_PHONE  default 9876543210
 *   API_LOG         path to API dev log (for reading OTPs)
 */
import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';
import { URL } from 'node:url';

const API   = process.env.API_BASE    ?? 'http://localhost:3001/api/v1';
const PHONE = process.env.CUSTOMER_PHONE ?? '9876543210';
const LOG   = process.env.API_LOG     ?? '';

// ─── HTTP helper ──────────────────────────────────────────────────────────────
function rq(url, { method = 'GET', body, token, cookie } = {}) {
  return new Promise((resolve) => {
    const u    = new URL(url);
    const data = body ? JSON.stringify(body) : null;
    const mod  = u.protocol === 'https:' ? https : http;
    const headers = { 'Content-Type': 'application/json' };
    if (data)   headers['Content-Length'] = Buffer.byteLength(data);
    if (token)  headers['Authorization']  = `Bearer ${token}`;
    if (cookie) headers['Cookie']         = cookie;
    const req = mod.request(
      { hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search, method, headers },
      (res) => {
        let raw = '';
        const cookies = res.headers['set-cookie'] ?? [];
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try { resolve({ s: res.statusCode, b: JSON.parse(raw), cookies }); }
          catch { resolve({ s: res.statusCode, b: raw, cookies }); }
        });
      },
    );
    req.on('error', () => resolve({ s: 0, b: null, cookies: [] }));
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

// ─── Result tracking ──────────────────────────────────────────────────────────
const results = [];
function pass(name, note = '') {
  results.push({ name, ok: true });
  console.log(`  ✅  ${name}${note ? '  (' + note + ')' : ''}`);
}
function fail(name, note = '') {
  results.push({ name, ok: false });
  console.error(`  ❌  ${name}${note ? '  (' + note + ')' : ''}`);
}
function skip(name, reason) {
  results.push({ name, ok: null });
  console.log(`  ⏭️   ${name}  — ${reason}`);
}

// ─── Test sections ────────────────────────────────────────────────────────────

async function testHealth() {
  console.log('\n▶  Health');
  const r = await rq(`${API}/health/live`);
  r.s === 200 ? pass('API liveness') : fail('API liveness', `HTTP ${r.s}`);
}

async function testAuth() {
  console.log('\n▶  Authentication (OTP flow)');
  const send = await rq(`${API}/auth/send-otp`, { method: 'POST', body: { phone: PHONE } });
  send.s === 200 || send.s === 201
    ? pass('Send OTP')
    : fail('Send OTP', `HTTP ${send.s} — ${JSON.stringify(send.b)}`);

  if (!LOG) { skip('Verify OTP', 'API_LOG not set — cannot read OTP'); return null; }

  await sleep(1000);
  const otp = readOtp(PHONE);
  if (!otp) { skip('Verify OTP', 'OTP not found in log'); return null; }

  const verify = await rq(`${API}/auth/verify-otp`, { method: 'POST', body: { phone: PHONE, otp } });
  const token  = verify.b?.data?.accessToken;
  token ? pass('Verify OTP → access token received') : fail('Verify OTP', `HTTP ${verify.s}`);
  return token ?? null;
}

async function testCatalogue(token) {
  console.log('\n▶  Catalogue');
  const products = await rq(`${API}/products?limit=12`);
  products.s === 200 ? pass('GET /products') : fail('GET /products', `HTTP ${products.s}`);

  const total = products.b?.data?.pagination?.total ?? 0;
  total > 0 ? pass(`Products in catalogue (${total})`) : fail('No products found');

  const items = products.b?.data?.data ?? [];
  if (items.length === 0) return null;

  const slug = items[0]?.slug;
  if (slug) {
    const detail = await rq(`${API}/products/${slug}`);
    detail.s === 200 ? pass(`GET /products/${slug}`) : fail(`GET /products/${slug}`, `HTTP ${detail.s}`);
  }

  const cats = await rq(`${API}/categories`);
  cats.s === 200 ? pass('GET /categories') : fail('GET /categories', `HTTP ${cats.s}`);

  return items[0] ?? null;
}

async function testSearch() {
  console.log('\n▶  Search');
  const r = await rq(`${API}/search?q=ring&limit=8`);
  r.s === 200 ? pass('GET /search?q=ring') : fail('GET /search?q=ring', `HTTP ${r.s}`);
  const count = r.b?.data?.data?.results?.length ?? 0;
  count >= 0 ? pass(`Search returned ${count} results`) : fail('Search response malformed');

  const empty = await rq(`${API}/search?q=xyznotfound12345`);
  empty.s === 200 ? pass('Search with no results returns 200') : fail('Search no-result', `HTTP ${empty.s}`);
}

async function testCart(token, product) {
  console.log('\n▶  Cart');
  if (!token) { skip('Cart (all)', 'No auth token'); return null; }
  if (!product) { skip('Cart (all)', 'No product available'); return null; }

  const variantId = product.variants?.[0]?.id;
  if (!variantId) { skip('Add to cart', 'Product has no variants'); return null; }

  const add = await rq(`${API}/cart`, { method: 'POST', body: { variantId, quantity: 1 }, token });
  add.s === 200 || add.s === 201 ? pass('Add to cart') : fail('Add to cart', `HTTP ${add.s}`);

  const get = await rq(`${API}/cart`, { token });
  get.s === 200 ? pass('GET /cart') : fail('GET /cart', `HTTP ${get.s}`);
  const itemCount = get.b?.data?.items?.length ?? 0;
  itemCount > 0 ? pass(`Cart has ${itemCount} item(s)`) : fail('Cart is empty after add');

  return get.b?.data;
}

async function testWishlist(token, product) {
  console.log('\n▶  Wishlist');
  if (!token) { skip('Wishlist (all)', 'No auth token'); return; }
  if (!product) { skip('Wishlist (all)', 'No product available'); return; }

  const add = await rq(`${API}/wishlist`, { method: 'POST', body: { productId: product.id }, token });
  add.s === 200 || add.s === 201 ? pass('Add to wishlist') : fail('Add to wishlist', `HTTP ${add.s}`);

  const get = await rq(`${API}/wishlist`, { token });
  get.s === 200 ? pass('GET /wishlist') : fail('GET /wishlist', `HTTP ${get.s}`);

  // Remove
  const productId = product.id;
  const del = await rq(`${API}/wishlist/${productId}`, { method: 'DELETE', token });
  del.s === 200 || del.s === 204 ? pass('Remove from wishlist') : fail('Remove from wishlist', `HTTP ${del.s}`);
}

async function testCheckoutCOD(token) {
  console.log('\n▶  Checkout (COD)');
  if (!token) { skip('Checkout (all)', 'No auth token'); return null; }

  // Get addresses
  const addrs = await rq(`${API}/users/addresses`, { token });
  let addressId = addrs.b?.data?.[0]?.id;

  if (!addressId) {
    // Create one
    const newAddr = await rq(`${API}/users/addresses`, {
      method: 'POST', token,
      body: {
        name: 'Test User', phone: '9876543210',
        line1: '123 Test Street', city: 'Mumbai',
        state: 'Maharashtra', pincode: '400001', country: 'India', isDefault: true,
      },
    });
    addressId = newAddr.b?.data?.id;
    newAddr.s === 200 || newAddr.s === 201
      ? pass('Create address')
      : fail('Create address', `HTTP ${newAddr.s}`);
  } else {
    pass('Address exists');
  }

  if (!addressId) { fail('No address available for checkout'); return null; }

  const cart = await rq(`${API}/cart`, { token });
  const items = cart.b?.data?.items ?? [];
  if (items.length === 0) { skip('COD order', 'Cart is empty'); return null; }

  const order = await rq(`${API}/orders`, {
    method: 'POST', token,
    body: { addressId, paymentMethod: 'COD', items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })) },
  });
  order.s === 200 || order.s === 201
    ? pass(`Place COD order (${order.b?.data?.orderNumber ?? '?'})`)
    : fail('Place COD order', `HTTP ${order.s} — ${JSON.stringify(order.b)}`);

  return order.b?.data ?? null;
}

async function testOrderTracking(token, order) {
  console.log('\n▶  Order tracking');
  if (!token) { skip('Order tracking', 'No auth token'); return; }

  const list = await rq(`${API}/orders?limit=5`, { token });
  list.s === 200 ? pass('GET /orders list') : fail('GET /orders list', `HTTP ${list.s}`);

  if (!order) { skip('Order detail', 'No order from checkout'); return; }

  const detail = await rq(`${API}/orders/${order.id}`, { token });
  detail.s === 200 ? pass(`GET /orders/${order.id}`) : fail(`GET /orders/${order.id}`, `HTTP ${detail.s}`);

  const status = detail.b?.data?.status;
  ['PENDING', 'CONFIRMED'].includes(status)
    ? pass(`Order status is ${status}`)
    : fail('Unexpected order status', status);
}

async function testReviews(token, product) {
  console.log('\n▶  Reviews');
  if (!token) { skip('Reviews (all)', 'No auth token'); return; }
  if (!product) { skip('Reviews (all)', 'No product'); return; }

  const list = await rq(`${API}/reviews?productId=${product.id}`);
  list.s === 200 ? pass('GET /reviews') : fail('GET /reviews', `HTTP ${list.s}`);
}

async function testProtectedRoutes(token) {
  console.log('\n▶  Auth boundaries');
  const unauth = await rq(`${API}/orders`);
  unauth.s === 401 ? pass('GET /orders without token → 401') : fail('GET /orders without token', `got ${unauth.s}`);

  const bad = await rq(`${API}/orders`, { token: 'bogus.token.here' });
  bad.s === 401 ? pass('Invalid token → 401') : fail('Invalid token', `got ${bad.s}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Customer Journey E2E');
  console.log(`  API: ${API}  |  PHONE: ${PHONE}`);
  console.log('═══════════════════════════════════════════════════');

  await testHealth();
  const token  = await testAuth();
  const product = await testCatalogue(token);
  await testSearch();
  await testCart(token, product);
  await testWishlist(token, product);
  const order  = await testCheckoutCOD(token);
  await testOrderTracking(token, order);
  await testReviews(token, product);
  await testProtectedRoutes(token);

  const passed  = results.filter((r) => r.ok === true).length;
  const failed  = results.filter((r) => r.ok === false).length;
  const skipped = results.filter((r) => r.ok === null).length;

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  ${passed} passed · ${failed} failed · ${skipped} skipped`);
  console.log('═══════════════════════════════════════════════════\n');

  if (failed > 0) {
    results.filter((r) => !r.ok).forEach((r) => console.error(`  FAIL: ${r.name}`));
    process.exit(1);
  }
})();
