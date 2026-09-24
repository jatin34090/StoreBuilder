/**
 * test-upload.mjs — DEV TOOL: tests whether multer parses multipart on the API server.
 *
 * Usage:
 *   node test-upload.mjs
 *
 * Interpretation:
 *   - Status 401 → multer IS working (request parsed; auth guard rejected unauthenticated call)
 *   - Status 500 "Cannot read properties of undefined (reading 'size')" → multer is NOT working
 *     even before auth is checked (the handler reached file.size with file=undefined)
 *   - Status 400 SyntaxError → server body-parser consumed the stream (wrong Content-Type sent)
 *
 * NOTE: This script does NOT supply auth credentials, so a 401 is the expected success signal.
 * The goal is to confirm multer runs at all, not to complete the upload.
 */

// Node 20: FormData and Blob are global — no import needed
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

const API_BASE = process.env.API_URL ?? 'http://localhost:3001/api/v1';
const ENDPOINT = `${API_BASE}/admin/banners/upload`;

// Minimal 1×1 white-pixel PNG (67 bytes, base64-encoded)
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==';
const pngBuffer = Buffer.from(PNG_B64, 'base64');

async function main() {
  console.log(`Sending multipart POST to ${ENDPOINT} (no auth — expect 401 if multer works)\n`);

  const form = new FormData();
  form.append('file', new Blob([pngBuffer], { type: 'image/png' }), 'test.png');

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      body: form,
      // Do NOT set Content-Type manually — fetch sets multipart/form-data + boundary automatically
    });
  } catch (err) {
    console.error('Network error (is the API server running?):', err.message);
    process.exit(1);
  }

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }

  console.log(`HTTP status : ${res.status}`);
  console.log(`Content-Type: ${res.headers.get('content-type')}`);
  console.log(`Body        :`, json ?? text);
  console.log();

  if (res.status === 401) {
    console.log('✓ RESULT: 401 Unauthorized — multer IS parsing multipart correctly.');
    console.log('  The banner upload failure is caused by something in the auth/admin layer,');
    console.log('  not by multer failing to read the file. Check auth credentials and x-store-slug.');
  } else if (res.status === 500) {
    const msg = json?.message ?? text;
    if (msg && msg.includes('size')) {
      console.log('✗ RESULT: 500 "Cannot read properties of undefined (reading \'size\')"');
      console.log('  multer is NOT populating req.file. The request body is not parsed as multipart.');
      console.log('  Check the Content-Type header in the [upload-diag] server log line.');
    } else {
      console.log('✗ RESULT: 500 (different error) —', msg);
    }
  } else if (res.status === 400) {
    console.log('✗ RESULT: 400 — body-parser consumed the stream (Content-Type was not multipart).');
    console.log('  The axios interceptor is not removing Content-Type before the request is sent.');
  } else {
    console.log(`? RESULT: unexpected status ${res.status}`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
