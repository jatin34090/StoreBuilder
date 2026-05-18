/**
 * Generate a URL-friendly slug from a string.
 * e.g. "Gold Plated Kundan Necklace Set" → "gold-plated-kundan-necklace-set"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Convert paise (integer) to rupees (decimal string).
 * e.g. 15000 → "150.00"
 */
export function paiseToRupees(paise: number): string {
  return (paise / 100).toFixed(2);
}

/**
 * Convert rupees to paise for Razorpay.
 * e.g. 150.00 → 15000
 */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/**
 * Format a number as Indian Rupees.
 * e.g. 1234.5 → "₹1,234.50"
 */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Mask a phone number for display.
 * e.g. "9876543210" → "+91 98765 ****"
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `+91 ${digits.slice(0, 5)} ****`;
}

/**
 * Generate a random 6-digit OTP string.
 * Note: Use crypto.randomInt on the server; this is for typing only.
 */
export function formatOtp(otp: number): string {
  return otp.toString().padStart(6, '0');
}

/**
 * Clamp a number between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Deep-pick selected keys from an object (single level).
 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) result[key] = obj[key];
  }
  return result;
}

/**
 * Omit selected keys from an object (single level).
 */
export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result as Omit<T, K>;
}

/**
 * Sleep for the given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if a value is a non-empty string.
 */
export function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
