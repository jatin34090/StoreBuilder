export interface IndustryTemplate {
  id: string;
  label: string;
  categories: string[];
  themeColor: string;
  navItems: string[];
  description: string;
}

export const INDUSTRY_TEMPLATES: Record<string, IndustryTemplate> = {
  JEWELLERY: {
    id: 'JEWELLERY',
    label: 'Jewellery',
    description: 'Rings, necklaces, earrings and fine jewellery',
    themeColor: '#8B5E3C',
    categories: ['Rings', 'Necklaces', 'Earrings', 'Bracelets', 'Pendants'],
    navItems: ['Home', 'Shop', 'Collections', 'About', 'Contact'],
  },
  FASHION: {
    id: 'FASHION',
    label: 'Fashion',
    description: 'Clothing, accessories and lifestyle',
    themeColor: '#1A1A2E',
    categories: ['Men', 'Women', 'Kids', 'Accessories', 'Sale'],
    navItems: ['Home', 'Men', 'Women', 'Kids', 'Sale'],
  },
  ELECTRONICS: {
    id: 'ELECTRONICS',
    label: 'Electronics',
    description: 'Gadgets, mobiles, laptops and tech accessories',
    themeColor: '#0052CC',
    categories: ['Mobiles', 'Laptops', 'Accessories', 'Audio', 'Cameras'],
    navItems: ['Home', 'Mobiles', 'Laptops', 'Accessories', 'Deals'],
  },
  BEAUTY: {
    id: 'BEAUTY',
    label: 'Beauty & Skincare',
    description: 'Cosmetics, skincare and wellness products',
    themeColor: '#C45BAA',
    categories: ['Skincare', 'Makeup', 'Haircare', 'Wellness', 'Fragrance'],
    navItems: ['Home', 'Skincare', 'Makeup', 'Haircare', 'Offers'],
  },
  FOOD: {
    id: 'FOOD',
    label: 'Food & Grocery',
    description: 'Packaged food, snacks and grocery items',
    themeColor: '#2E7D32',
    categories: ['Snacks', 'Beverages', 'Dairy', 'Organic', 'Bakery'],
    navItems: ['Home', 'Fresh', 'Snacks', 'Beverages', 'Offers'],
  },
  GENERAL: {
    id: 'GENERAL',
    label: 'General / Other',
    description: 'Everything else — customize as needed',
    themeColor: '#5C35D9',
    categories: [],
    navItems: ['Home', 'Shop', 'About', 'Contact'],
  },
};

export function getTemplate(industry: string): IndustryTemplate {
  return INDUSTRY_TEMPLATES[industry?.toUpperCase()] ?? INDUSTRY_TEMPLATES.GENERAL;
}
