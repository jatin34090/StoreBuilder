import {
  slugify,
  paiseToRupees,
  rupeesToPaise,
  maskPhone,
  clamp,
} from '@jewellery/utils';

describe('@jewellery/utils', () => {
  describe('slugify', () => {
    it('produces url-friendly slugs', () => {
      expect(slugify('Gold Plated Kundan Necklace Set')).toBe('gold-plated-kundan-necklace-set');
    });
    it('strips special characters and collapses separators', () => {
      expect(slugify('  Ring (22k) — Rose/Gold!  ')).toBe('ring-22k-rosegold');
    });
  });

  describe('money conversions', () => {
    it('paise → rupees string', () => {
      expect(paiseToRupees(15000)).toBe('150.00');
      expect(paiseToRupees(99)).toBe('0.99');
    });
    it('rupees → paise integer', () => {
      expect(rupeesToPaise(150)).toBe(15000);
      expect(rupeesToPaise(0.99)).toBe(99);
    });
    it('round-trips', () => {
      expect(rupeesToPaise(Number(paiseToRupees(123456)))).toBe(123456);
    });
  });

  describe('maskPhone', () => {
    it('masks the middle digits', () => {
      const masked = maskPhone('9876543210');
      expect(masked).not.toContain('76543');
      expect(masked).toMatch(/\d/);
    });
  });

  describe('clamp', () => {
    it('bounds a value', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-3, 0, 10)).toBe(0);
      expect(clamp(42, 0, 10)).toBe(10);
    });
  });
});
