// k6 load/smoke test for read-heavy public endpoints.
//   k6 run -e BASE_URL=https://api.yourdomain.in/api/v1 tests/load/k6-smoke.js
//
// Stages ramp to 50 concurrent VUs. Thresholds fail the run if p95 latency or
// error rate exceed budget — wire into CI/CD as a release gate.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:3001/api/v1';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'], // < 1% errors
    http_req_duration: ['p(95)<800'], // 95% under 800ms
    checks: ['rate>0.99'],
  },
};

export default function () {
  // Liveness — cheap, no deps.
  const live = http.get(`${BASE}/health/live`);
  check(live, { 'health 200': (r) => r.status === 200 });

  // Public catalogue read.
  const products = http.get(`${BASE}/products?limit=12`);
  check(products, {
    'products 200': (r) => r.status === 200,
    'products has data': (r) => r.body && r.body.includes('data'),
  });

  // Public search.
  const search = http.get(`${BASE}/search?q=ring`);
  check(search, { 'search 200': (r) => r.status === 200 });

  sleep(1);
}
