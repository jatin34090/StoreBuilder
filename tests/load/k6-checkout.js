// k6 checkout & search performance test.
// Measures: search latency, product page, cart operations, order placement.
//
//   k6 run -e BASE_URL=https://api.staging.yourdomain.in/api/v1 \
//           -e TOKEN=<customer-jwt> \
//           tests/load/k6-checkout.js
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE  = __ENV.BASE_URL || 'http://localhost:3001/api/v1';
const TOKEN = __ENV.TOKEN    || '';

const searchLatency   = new Trend('search_latency');
const checkoutLatency = new Trend('checkout_latency');
const errorRate       = new Rate('error_rate');

export const options = {
  scenarios: {
    // Ramp load — typical browse traffic
    browse: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m',  target: 50 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed:   ['rate<0.01'],   // < 1% errors
    http_req_duration: ['p(95)<800'],   // 95th percentile under 800ms
    search_latency:    ['p(95)<600'],   // search under 600ms
    checkout_latency:  ['p(95)<1500'],  // checkout under 1.5s
    error_rate:        ['rate<0.01'],
  },
};

const headers = (extra = {}) => ({
  'Content-Type': 'application/json',
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
  ...extra,
});

export default function () {
  group('Health', () => {
    const r = http.get(`${BASE}/health/live`);
    check(r, { 'live 200': (x) => x.status === 200 });
    errorRate.add(r.status !== 200);
  });

  group('Catalogue', () => {
    const r = http.get(`${BASE}/products?limit=12`);
    check(r, {
      'products 200':      (x) => x.status === 200,
      'products has data': (x) => x.body?.includes('"data"'),
    });
    errorRate.add(r.status !== 200);
  });

  group('Search', () => {
    const queries = ['ring', 'necklace', 'earring', 'bangle', 'gold'];
    const q = queries[Math.floor(Math.random() * queries.length)];
    const r = http.get(`${BASE}/search?q=${q}&limit=8`);
    searchLatency.add(r.timings.duration);
    check(r, { 'search 200': (x) => x.status === 200 });
    errorRate.add(r.status !== 200);
  });

  group('Categories', () => {
    const r = http.get(`${BASE}/categories`);
    check(r, { 'categories 200': (x) => x.status === 200 });
  });

  if (TOKEN) {
    group('Cart', () => {
      const r = http.get(`${BASE}/cart`, { headers: headers() });
      check(r, { 'cart 200': (x) => x.status === 200 });
    });

    group('Orders list', () => {
      const start = Date.now();
      const r = http.get(`${BASE}/orders?limit=5`, { headers: headers() });
      checkoutLatency.add(Date.now() - start);
      check(r, { 'orders 200': (x) => x.status === 200 });
    });
  }

  sleep(1);
}
