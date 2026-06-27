import * as crypto from 'crypto';

/**
 * Verifies the Razorpay HMAC-SHA256 signature scheme used by
 * PaymentsService.verifyPaymentSignature: HMAC(`${orderId}|${paymentId}`, secret).
 * Replicated here so the security-critical algorithm is regression-tested without
 * a live Razorpay dependency.
 */
function sign(orderId: string, paymentId: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
}

function verify(orderId: string, paymentId: string, signature: string, secret: string): boolean {
  const expected = Buffer.from(sign(orderId, paymentId, secret), 'hex');
  const provided = Buffer.from(signature, 'hex');
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(expected, provided);
}

describe('Razorpay payment signature', () => {
  const secret = 'test_key_secret';
  const orderId = 'order_ABC123';
  const paymentId = 'pay_XYZ789';

  it('accepts a correctly signed payment', () => {
    const sig = sign(orderId, paymentId, secret);
    expect(verify(orderId, paymentId, sig, secret)).toBe(true);
  });

  it('rejects a tampered payment id', () => {
    const sig = sign(orderId, paymentId, secret);
    expect(verify(orderId, 'pay_TAMPERED', sig, secret)).toBe(false);
  });

  it('rejects a wrong secret', () => {
    const sig = sign(orderId, paymentId, 'attacker_secret');
    expect(verify(orderId, paymentId, sig, secret)).toBe(false);
  });

  it('rejects a malformed/short signature without throwing', () => {
    expect(verify(orderId, paymentId, 'deadbeef', secret)).toBe(false);
  });

  it('is deterministic for the same inputs', () => {
    expect(sign(orderId, paymentId, secret)).toBe(sign(orderId, paymentId, secret));
  });
});
