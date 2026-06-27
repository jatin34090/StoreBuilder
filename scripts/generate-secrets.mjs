#!/usr/bin/env node
/**
 * Generate all platform secrets locally and print them ready to paste into
 * your secret manager or .env.production.
 *
 * Usage:
 *   node scripts/generate-secrets.mjs
 *
 * Requires: Node 20+ (uses node:crypto built-in).
 * Does NOT touch any files — output is stdout only.
 */
import { generateKeyPairSync, randomBytes } from 'node:crypto';

function hex(n = 32) {
  return randomBytes(n).toString('hex');
}

function base64(n = 32) {
  return randomBytes(n).toString('base64url');
}

// ── JWT RS256 keypair ──────────────────────────────────────────────────────
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// Inline PEM for .env (replace newlines with \n literal)
const privInline = privateKey.replace(/\n/g, '\\n');
const pubInline = publicKey.replace(/\n/g, '\\n');

// ── Output ─────────────────────────────────────────────────────────────────
console.log('# ── Generated secrets (' + new Date().toISOString() + ') ──');
console.log('# Paste into your secret manager, NOT into a committed file.\n');

console.log('# JWT RS256 keys');
console.log(`JWT_PRIVATE_KEY="${privInline}"`);
console.log(`JWT_PUBLIC_KEY="${pubInline}"\n`);

console.log('# Redis');
console.log(`REDIS_PASSWORD="${hex(24)}"\n`);

console.log('# Typesense');
console.log(`TYPESENSE_API_KEY="${hex(24)}"\n`);

console.log('# Session / misc tokens');
console.log(`INTERNAL_API_KEY="${base64(32)}"`);
console.log(`WEBHOOK_SECRET="${hex(32)}"\n`);

console.log('# VAPID keys for web push (if used)');
const vapidPair = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  publicKeyEncoding: { type: 'spki', format: 'der' },
  privateKeyEncoding: { type: 'pkcs8', format: 'der' },
});
console.log(`VAPID_PUBLIC_KEY="${vapidPair.publicKey.toString('base64')}"`);
console.log(`VAPID_PRIVATE_KEY="${vapidPair.privateKey.toString('base64')}"\n`);

console.log('# ── Manual steps (cannot be generated here) ─────────────────');
console.log('# DATABASE_URL      → Neon dashboard: rotate password, copy pooled URL');
console.log('# DIRECT_URL        → Neon dashboard: copy direct (unpooled) URL');
console.log('# RAZORPAY_KEY_ID   → Razorpay dashboard (use live keys for prod)');
console.log('# RAZORPAY_KEY_SECRET → Razorpay dashboard');
console.log('# CLOUDINARY_*      → Cloudinary dashboard');
console.log('# SENTRY_DSN        → Sentry project settings → SDK Setup');
console.log('# EAS_*             → expo.dev account');
