/**
 * prisma/seed.ts — Jewellery Platform
 *
 * Idempotent: safe to run multiple times.
 * All seed records use stable UUIDs so re-runs upsert in place.
 *
 * Run: pnpm --filter api exec prisma db seed
 *   or: npx prisma db seed   (from repo root)
 */

import {
  PrismaClient,
  Role,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  DeliveryType,
  DeliveryStatus,
  NotificationType,
  CouponType,
  Prisma,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 10;

// ─── Stable Seed IDs (never change these) ────────────────────────────────────

const ID = {
  // Users
  adminUser:    '10000000-0000-0000-0000-000000000001',
  customerUser: '10000000-0000-0000-0000-000000000002',
  agentUser:    '10000000-0000-0000-0000-000000000003',

  // Agent profile (DeliveryAgent record)
  agentProfile: '20000000-0000-0000-0000-000000000001',

  // Address
  customerAddress: '30000000-0000-0000-0000-000000000001',

  // Categories
  catRings:    '40000000-0000-0000-0000-000000000001',
  catNecklace: '40000000-0000-0000-0000-000000000002',
  catEarrings: '40000000-0000-0000-0000-000000000003',
  catBangles:  '40000000-0000-0000-0000-000000000004',

  // Products
  prodRing:     '50000000-0000-0000-0000-000000000001',
  prodNecklace: '50000000-0000-0000-0000-000000000002',
  prodEarrings: '50000000-0000-0000-0000-000000000003',
  prodBangle:   '50000000-0000-0000-0000-000000000004',
  prodPendant:  '50000000-0000-0000-0000-000000000005',

  // Product Variants
  varRingS6:       '60000000-0000-0000-0000-000000000001',
  varRingS7:       '60000000-0000-0000-0000-000000000002',
  varRingS8Low:    '60000000-0000-0000-0000-000000000003',
  varNecklace16:   '60000000-0000-0000-0000-000000000004',
  varNecklace18:   '60000000-0000-0000-0000-000000000005',
  varEarringsStud: '60000000-0000-0000-0000-000000000006',
  varBangle24:     '60000000-0000-0000-0000-000000000007',
  varPendant:      '60000000-0000-0000-0000-000000000008',

  // Product Images (primary images)
  imgRing:     '61000000-0000-0000-0000-000000000001',
  imgNecklace: '61000000-0000-0000-0000-000000000002',
  imgEarrings: '61000000-0000-0000-0000-000000000003',
  imgBangle:   '61000000-0000-0000-0000-000000000004',
  imgPendant:  '61000000-0000-0000-0000-000000000005',

  // Coupons
  couponWelcome: '70000000-0000-0000-0000-000000000001',
  couponFlat:    '70000000-0000-0000-0000-000000000002',
  couponExpired: '70000000-0000-0000-0000-000000000003',

  // Orders
  order1Delivered:      '80000000-0000-0000-0000-000000000001',
  order2OutForDelivery: '80000000-0000-0000-0000-000000000002',
  order3Assigned:       '80000000-0000-0000-0000-000000000003',
  order4ThirdParty:     '80000000-0000-0000-0000-000000000004',
  order5Pending:        '80000000-0000-0000-0000-000000000005',

  // Order Items (stable IDs per order)
  item1a: '81000000-0000-0000-0000-000000000001',
  item2a: '81000000-0000-0000-0000-000000000002',
  item3a: '81000000-0000-0000-0000-000000000003',
  item4a: '81000000-0000-0000-0000-000000000004',
  item5a: '81000000-0000-0000-0000-000000000005',

  // Review
  review1: '90000000-0000-0000-0000-000000000001',

  // Notifications
  notif1: 'a0000000-0000-0000-0000-000000000001',
  notif2: 'a0000000-0000-0000-0000-000000000002',
  notif3: 'a0000000-0000-0000-0000-000000000003',
  notif4: 'a0000000-0000-0000-0000-000000000004',
} as const;

// ─── Test Credentials ─────────────────────────────────────────────────────────

export const SEED_CREDS = {
  admin:    { email: 'admin@jewellery.test',    password: 'Admin@123456'    },
  customer: { phone: '9000000001',              password: 'Customer@123456' },
  agent:    { phone: '9000000002',              password: 'Agent@123456'    },
};

// Pre-seeded OTP for ORDER_2 (OUT_FOR_DELIVERY) — use this OTP in Postman
export const SEED_OTP = '482910';

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱  Starting seed...\n');

  await seedUsers();
  await seedDeliveryAgent();
  await seedAddresses();
  await seedCategories();
  await seedProducts();
  await seedProductImages();
  await seedCoupons();
  await seedOrders();
  await seedReviews();
  await seedNotifications();

  console.log('\n✅  Seed complete!\n');
  printSeedSummary();
}

// ─── Users ────────────────────────────────────────────────────────────────────

async function seedUsers() {
  console.log('  → Users');

  const [adminHash, customerHash, agentHash] = await Promise.all([
    bcrypt.hash(SEED_CREDS.admin.password,    BCRYPT_ROUNDS),
    bcrypt.hash(SEED_CREDS.customer.password, BCRYPT_ROUNDS),
    bcrypt.hash(SEED_CREDS.agent.password,    BCRYPT_ROUNDS),
  ]);

  await prisma.user.upsert({
    where:  { id: ID.adminUser },
    update: { passwordHash: adminHash },
    create: {
      id:           ID.adminUser,
      name:         'Seed Admin',
      email:        SEED_CREDS.admin.email,
      passwordHash: adminHash,
      role:         Role.ADMIN,
      isVerified:   true,
    },
  });

  await prisma.user.upsert({
    where:  { id: ID.customerUser },
    update: { passwordHash: customerHash },
    create: {
      id:           ID.customerUser,
      name:         'Priya Sharma',
      phone:        SEED_CREDS.customer.phone,
      email:        'customer@jewellery.test',
      passwordHash: customerHash,
      role:         Role.CUSTOMER,
      isVerified:   true,
    },
  });

  await prisma.user.upsert({
    where:  { id: ID.agentUser },
    update: { passwordHash: agentHash },
    create: {
      id:           ID.agentUser,
      name:         'Ravi Kumar',
      phone:        SEED_CREDS.agent.phone,
      email:        'agent@jewellery.test',
      passwordHash: agentHash,
      role:         Role.DELIVERY_AGENT,
      isVerified:   true,
    },
  });
}

// ─── Delivery Agent ───────────────────────────────────────────────────────────

async function seedDeliveryAgent() {
  console.log('  → DeliveryAgent');

  await prisma.deliveryAgent.upsert({
    where:  { userId: ID.agentUser },
    update: { isOnline: true },
    create: {
      id:          ID.agentProfile,
      userId:      ID.agentUser,
      vehicleType: 'bike',
      zones:       ['400001', '400002', '400003', '400004', '400005'],
      isOnline:    true,
      currentLat:  19.0760,
      currentLng:  72.8777,
      rating:      4.8,
    },
  });
}

// ─── Addresses ────────────────────────────────────────────────────────────────

async function seedAddresses() {
  console.log('  → Addresses');

  await prisma.address.upsert({
    where:  { id: ID.customerAddress },
    update: {},
    create: {
      id:        ID.customerAddress,
      userId:    ID.customerUser,
      name:      'Priya Sharma',
      phone:     '9000000001',
      line1:     '12, Lotus Apartments, MG Road',
      line2:     'Near Central Mall',
      city:      'Mumbai',
      state:     'Maharashtra',
      pincode:   '400001',
      isDefault: true,
    },
  });
}

// ─── Categories ───────────────────────────────────────────────────────────────

async function seedCategories() {
  console.log('  → Categories');

  const cats = [
    { id: ID.catRings,    name: 'Rings',               slug: 'rings',               sortOrder: 1 },
    { id: ID.catNecklace, name: 'Necklaces & Pendants', slug: 'necklaces-pendants',  sortOrder: 2 },
    { id: ID.catEarrings, name: 'Earrings',             slug: 'earrings',            sortOrder: 3 },
    { id: ID.catBangles,  name: 'Bangles & Bracelets',  slug: 'bangles-bracelets',   sortOrder: 4 },
  ];

  for (const cat of cats) {
    await prisma.category.upsert({
      where:  { id: cat.id },
      update: { name: cat.name },
      create: { ...cat, isActive: true },
    });
  }
}

// ─── Products ─────────────────────────────────────────────────────────────────

async function seedProducts() {
  console.log('  → Products & Variants');

  // Product 1: Gold Zirconia Ring
  await prisma.product.upsert({
    where:  { id: ID.prodRing },
    update: {},
    create: {
      id:          ID.prodRing,
      name:        'Royal Gold Zirconia Ring',
      slug:        'royal-gold-zirconia-ring',
      description: 'Elegant gold-plated ring adorned with sparkling cubic zirconia stones. Perfect for weddings and festive occasions. Hypoallergenic, nickel-free.',
      categoryId:  ID.catRings,
      basePrice:   new Prisma.Decimal('699.00'),
      discountPct: 14,
      attributes:  { material: 'Gold-Plated Brass', occasion: 'Wedding', color: 'Gold', finish: 'Polished', stone: 'Cubic Zirconia', weight: '8g' },
      tags:        ['ring', 'gold', 'zirconia', 'wedding', 'festive'],
      metaTitle:   'Royal Gold Zirconia Ring | Buy Online India',
      metaDesc:    'Shop elegant gold-plated cubic zirconia rings. Free shipping above ₹999.',
      isFeatured:  true,
      isActive:    true,
    },
  });

  const ringVariants = [
    { id: ID.varRingS6,    sku: 'RNG-GLD-CZ-S6', size: 'Size 6',  color: 'Gold', price: new Prisma.Decimal('599.00'),  stock: 15, weight: 8.0 },
    { id: ID.varRingS7,    sku: 'RNG-GLD-CZ-S7', size: 'Size 7',  color: 'Gold', price: new Prisma.Decimal('599.00'),  stock: 20, weight: 8.0 },
    { id: ID.varRingS8Low, sku: 'RNG-GLD-CZ-S8', size: 'Size 8',  color: 'Gold', price: new Prisma.Decimal('599.00'),  stock: 2,  weight: 8.0 },
  ];
  for (const v of ringVariants) {
    await prisma.productVariant.upsert({ where: { id: v.id }, update: { stock: v.stock }, create: { ...v, productId: ID.prodRing } });
  }

  // Product 2: Pearl Necklace
  await prisma.product.upsert({
    where:  { id: ID.prodNecklace },
    update: {},
    create: {
      id:          ID.prodNecklace,
      name:        'Pearl Elegance Choker Necklace',
      slug:        'pearl-elegance-choker-necklace',
      description: 'Timeless pearl choker necklace with a rhodium-plated silver finish. Double-strand freshwater pearl design with a secure lobster clasp.',
      categoryId:  ID.catNecklace,
      basePrice:   new Prisma.Decimal('1499.00'),
      discountPct: 13,
      attributes:  { material: 'Rhodium-Plated Silver', occasion: 'Party', color: 'White', finish: 'Glossy', stone: 'Freshwater Pearl', weight: '22g' },
      tags:        ['necklace', 'pearl', 'choker', 'silver', 'party'],
      metaTitle:   'Pearl Elegance Choker Necklace | Buy Online',
      metaDesc:    'Classic freshwater pearl choker necklace. Perfect party and bridal jewellery.',
      isFeatured:  true,
      isActive:    true,
    },
  });

  const necklaceVariants = [
    { id: ID.varNecklace16, sku: 'NCK-PRL-16', size: '16 inch', color: 'White', price: new Prisma.Decimal('1299.00'), stock: 10, weight: 22.0 },
    { id: ID.varNecklace18, sku: 'NCK-PRL-18', size: '18 inch', color: 'White', price: new Prisma.Decimal('1399.00'), stock: 8,  weight: 24.0 },
  ];
  for (const v of necklaceVariants) {
    await prisma.productVariant.upsert({ where: { id: v.id }, update: { stock: v.stock }, create: { ...v, productId: ID.prodNecklace } });
  }

  // Product 3: Diamond Drop Earrings
  await prisma.product.upsert({
    where:  { id: ID.prodEarrings },
    update: {},
    create: {
      id:          ID.prodEarrings,
      name:        'Diamond Drop Dangle Earrings',
      slug:        'diamond-drop-dangle-earrings',
      description: 'Stunning solitaire diamond-cut crystal drop earrings. White gold plated with anti-tarnish coating. Suitable for sensitive ears.',
      categoryId:  ID.catEarrings,
      basePrice:   new Prisma.Decimal('999.00'),
      discountPct: 10,
      attributes:  { material: 'White Gold Plated Brass', occasion: 'Casual', color: 'Silver', finish: 'Matte', stone: 'Crystal', weight: '6g' },
      tags:        ['earrings', 'diamond', 'drop', 'crystal', 'dangle'],
      isFeatured:  false,
      isActive:    true,
    },
  });

  await prisma.productVariant.upsert({
    where:  { id: ID.varEarringsStud },
    update: { stock: 25 },
    create: { id: ID.varEarringsStud, productId: ID.prodEarrings, sku: 'ERG-DMD-DROP', size: 'Standard', color: 'Silver', price: new Prisma.Decimal('899.00'), stock: 25, weight: 6.0 },
  });

  // Product 4: Silver Filigree Bangle
  await prisma.product.upsert({
    where:  { id: ID.prodBangle },
    update: {},
    create: {
      id:          ID.prodBangle,
      name:        'Silver Filigree Ethnic Bangle',
      slug:        'silver-filigree-ethnic-bangle',
      description: '925 sterling silver bangle with intricate filigree work. Lightweight and comfortable for daily wear. Comes in a gift box.',
      categoryId:  ID.catBangles,
      basePrice:   new Prisma.Decimal('549.00'),
      discountPct: 18,
      attributes:  { material: '925 Sterling Silver', occasion: 'Daily', color: 'Silver', finish: 'Antique', stone: 'None', weight: '15g' },
      tags:        ['bangle', 'silver', 'filigree', 'ethnic', 'sterling'],
      isFeatured:  false,
      isActive:    true,
    },
  });

  await prisma.productVariant.upsert({
    where:  { id: ID.varBangle24 },
    update: { stock: 3 },
    create: { id: ID.varBangle24, productId: ID.prodBangle, sku: 'BNG-SLV-FLG-24', size: '2.4 inch', color: 'Silver', price: new Prisma.Decimal('449.00'), stock: 3, weight: 15.0 },
  });

  // Product 5: Kundan Pendant
  await prisma.product.upsert({
    where:  { id: ID.prodPendant },
    update: {},
    create: {
      id:          ID.prodPendant,
      name:        'Kundan Floral Statement Pendant',
      slug:        'kundan-floral-statement-pendant',
      description: 'Traditional Kundan floral pendant with meenakari back. Gold-plated brass with hand-set Kundan stones. Includes a matching chain.',
      categoryId:  ID.catNecklace,
      basePrice:   new Prisma.Decimal('899.00'),
      discountPct: 17,
      attributes:  { material: 'Gold-Plated Brass', occasion: 'Festive', color: 'Gold', finish: 'Kundan', stone: 'Kundan', weight: '18g' },
      tags:        ['pendant', 'kundan', 'festive', 'traditional', 'gold'],
      isFeatured:  true,
      isActive:    true,
    },
  });

  await prisma.productVariant.upsert({
    where:  { id: ID.varPendant },
    update: { stock: 12 },
    create: { id: ID.varPendant, productId: ID.prodPendant, sku: 'PND-KND-FLR', size: 'Standard', color: 'Gold', price: new Prisma.Decimal('749.00'), stock: 12, weight: 18.0 },
  });
}

// ─── Product Images ───────────────────────────────────────────────────────────

async function seedProductImages() {
  console.log('  → Product Images');

  const images = [
    { id: ID.imgRing,     productId: ID.prodRing,     publicId: 'jewellery/rings/royal-gold-cz-ring',       url: 'https://res.cloudinary.com/demo/image/upload/jewellery/rings/royal-gold-cz-ring.jpg'     },
    { id: ID.imgNecklace, productId: ID.prodNecklace, publicId: 'jewellery/necklaces/pearl-elegance-choker', url: 'https://res.cloudinary.com/demo/image/upload/jewellery/necklaces/pearl-elegance-choker.jpg' },
    { id: ID.imgEarrings, productId: ID.prodEarrings, publicId: 'jewellery/earrings/diamond-drop-dangle',    url: 'https://res.cloudinary.com/demo/image/upload/jewellery/earrings/diamond-drop-dangle.jpg'    },
    { id: ID.imgBangle,   productId: ID.prodBangle,   publicId: 'jewellery/bangles/silver-filigree-ethnic',  url: 'https://res.cloudinary.com/demo/image/upload/jewellery/bangles/silver-filigree-ethnic.jpg'  },
    { id: ID.imgPendant,  productId: ID.prodPendant,  publicId: 'jewellery/pendants/kundan-floral',          url: 'https://res.cloudinary.com/demo/image/upload/jewellery/pendants/kundan-floral.jpg'          },
  ];

  for (const img of images) {
    await prisma.productImage.upsert({
      where:  { id: img.id },
      update: {},
      create: { ...img, isPrimary: true, sortOrder: 0 },
    });
  }
}

// ─── Coupons ──────────────────────────────────────────────────────────────────

async function seedCoupons() {
  console.log('  → Coupons');

  await prisma.coupon.upsert({
    where:  { id: ID.couponWelcome },
    update: {},
    create: {
      id:            ID.couponWelcome,
      code:          'WELCOME10',
      type:          CouponType.PERCENT,
      value:         new Prisma.Decimal('10'),
      minOrderAmount: new Prisma.Decimal('500'),
      maxDiscount:   new Prisma.Decimal('200'),
      usageLimit:    1000,
      usedCount:     42,
      expiresAt:     new Date('2027-12-31'),
      isActive:      true,
    },
  });

  await prisma.coupon.upsert({
    where:  { id: ID.couponFlat },
    update: {},
    create: {
      id:            ID.couponFlat,
      code:          'FLAT100',
      type:          CouponType.FLAT,
      value:         new Prisma.Decimal('100'),
      minOrderAmount: new Prisma.Decimal('800'),
      maxDiscount:   null,
      usageLimit:    500,
      usedCount:     18,
      expiresAt:     new Date('2027-06-30'),
      isActive:      true,
    },
  });

  await prisma.coupon.upsert({
    where:  { id: ID.couponExpired },
    update: {},
    create: {
      id:            ID.couponExpired,
      code:          'EXPIRED50',
      type:          CouponType.PERCENT,
      value:         new Prisma.Decimal('50'),
      minOrderAmount: null,
      maxDiscount:   null,
      usageLimit:    null,
      usedCount:     0,
      expiresAt:     new Date('2024-01-01'),
      isActive:      false,
    },
  });
}

// ─── Orders ───────────────────────────────────────────────────────────────────

async function seedOrders() {
  console.log('  → Orders, Payments & Deliveries');

  const otpHash = await bcrypt.hash(SEED_OTP, BCRYPT_ROUNDS);

  // ── ORDER 1: DELIVERED (review-ready, Razorpay UPI, SELF delivery OTP verified) ──

  await prisma.order.upsert({
    where:  { id: ID.order1Delivered },
    update: { status: OrderStatus.DELIVERED },
    create: {
      id:            ID.order1Delivered,
      orderNumber:   'ORD-SEED-001',
      userId:        ID.customerUser,
      addressId:     ID.customerAddress,
      status:        OrderStatus.DELIVERED,
      subtotal:      new Prisma.Decimal('1198.00'),
      discountAmount:new Prisma.Decimal('0.00'),
      shippingCharge:new Prisma.Decimal('0.00'),
      total:         new Prisma.Decimal('1198.00'),
      notes:         'Seed order — ring × 2',
    },
  });

  const items1 = await prisma.orderItem.count({ where: { orderId: ID.order1Delivered } });
  if (items1 === 0) {
    await prisma.orderItem.create({
      data: {
        id:       ID.item1a,
        orderId:  ID.order1Delivered,
        variantId: ID.varRingS6,
        name:     'Royal Gold Zirconia Ring',
        sku:      'RNG-GLD-CZ-S6',
        price:    new Prisma.Decimal('599.00'),
        quantity: 2,
        image:    'https://res.cloudinary.com/demo/image/upload/jewellery/rings/royal-gold-cz-ring.jpg',
      },
    });
  }

  await prisma.payment.upsert({
    where:  { orderId: ID.order1Delivered },
    update: {},
    create: {
      orderId:         ID.order1Delivered,
      method:          PaymentMethod.UPI,
      gateway:         'razorpay',
      razorpayOrderId: 'order_seed_001_rzp',
      razorpayPayId:   'pay_seed_001_rzp',
      amount:          new Prisma.Decimal('1198.00'),
      status:          PaymentStatus.SUCCESS,
      paidAt:          new Date('2026-05-10T11:00:00Z'),
    },
  });

  await prisma.delivery.upsert({
    where:  { orderId: ID.order1Delivered },
    update: {},
    create: {
      orderId:     ID.order1Delivered,
      type:        DeliveryType.SELF,
      agentId:     ID.agentProfile,
      status:      DeliveryStatus.DELIVERED,
      otpHash:     await bcrypt.hash('111111', BCRYPT_ROUNDS),
      otpVerified: true,
      estimatedAt: new Date('2026-05-11T14:00:00Z'),
      deliveredAt: new Date('2026-05-11T13:45:00Z'),
      locationLog: [
        { lat: 19.0720, lng: 72.8750, timestamp: '2026-05-11T13:00:00Z' },
        { lat: 19.0740, lng: 72.8760, timestamp: '2026-05-11T13:20:00Z' },
        { lat: 19.0760, lng: 72.8777, timestamp: '2026-05-11T13:40:00Z' },
      ],
    },
  });

  // ── ORDER 2: OUT_FOR_DELIVERY (OTP ready to verify, SEED_OTP = '482910') ──

  await prisma.order.upsert({
    where:  { id: ID.order2OutForDelivery },
    update: { status: OrderStatus.OUT_FOR_DELIVERY },
    create: {
      id:            ID.order2OutForDelivery,
      orderNumber:   'ORD-SEED-002',
      userId:        ID.customerUser,
      addressId:     ID.customerAddress,
      status:        OrderStatus.OUT_FOR_DELIVERY,
      subtotal:      new Prisma.Decimal('1299.00'),
      discountAmount:new Prisma.Decimal('0.00'),
      shippingCharge:new Prisma.Decimal('0.00'),
      total:         new Prisma.Decimal('1299.00'),
      notes:         'Seed order — pearl necklace 16"',
    },
  });

  const items2 = await prisma.orderItem.count({ where: { orderId: ID.order2OutForDelivery } });
  if (items2 === 0) {
    await prisma.orderItem.create({
      data: {
        id:        ID.item2a,
        orderId:   ID.order2OutForDelivery,
        variantId: ID.varNecklace16,
        name:      'Pearl Elegance Choker Necklace',
        sku:       'NCK-PRL-16',
        price:     new Prisma.Decimal('1299.00'),
        quantity:  1,
        image:     'https://res.cloudinary.com/demo/image/upload/jewellery/necklaces/pearl-elegance-choker.jpg',
      },
    });
  }

  await prisma.payment.upsert({
    where:  { orderId: ID.order2OutForDelivery },
    update: {},
    create: {
      orderId: ID.order2OutForDelivery,
      method:  PaymentMethod.COD,
      gateway: 'cod',
      amount:  new Prisma.Decimal('1299.00'),
      status:  PaymentStatus.SUCCESS,
      paidAt:  new Date('2026-05-18T09:00:00Z'),
    },
  });

  await prisma.delivery.upsert({
    where:  { orderId: ID.order2OutForDelivery },
    update: { otpHash, otpVerified: false },
    create: {
      orderId:     ID.order2OutForDelivery,
      type:        DeliveryType.SELF,
      agentId:     ID.agentProfile,
      status:      DeliveryStatus.OUT_FOR_DELIVERY,
      otpHash,
      otpVerified: false,
      estimatedAt: new Date('2026-05-21T15:00:00Z'),
      locationLog: [
        { lat: 19.0740, lng: 72.8765, timestamp: '2026-05-21T13:00:00Z' },
        { lat: 19.0755, lng: 72.8772, timestamp: '2026-05-21T13:30:00Z' },
      ],
    },
  });

  // ── ORDER 3: ASSIGNED (agent assigned, ready for PICKED_UP → ... → DELIVERED flow) ──

  await prisma.order.upsert({
    where:  { id: ID.order3Assigned },
    update: { status: OrderStatus.CONFIRMED },
    create: {
      id:            ID.order3Assigned,
      orderNumber:   'ORD-SEED-003',
      userId:        ID.customerUser,
      addressId:     ID.customerAddress,
      status:        OrderStatus.CONFIRMED,
      subtotal:      new Prisma.Decimal('899.00'),
      discountAmount:new Prisma.Decimal('0.00'),
      shippingCharge:new Prisma.Decimal('49.00'),
      total:         new Prisma.Decimal('948.00'),
      notes:         'Seed order — diamond earrings',
    },
  });

  const items3 = await prisma.orderItem.count({ where: { orderId: ID.order3Assigned } });
  if (items3 === 0) {
    await prisma.orderItem.create({
      data: {
        id:        ID.item3a,
        orderId:   ID.order3Assigned,
        variantId: ID.varEarringsStud,
        name:      'Diamond Drop Dangle Earrings',
        sku:       'ERG-DMD-DROP',
        price:     new Prisma.Decimal('899.00'),
        quantity:  1,
        image:     'https://res.cloudinary.com/demo/image/upload/jewellery/earrings/diamond-drop-dangle.jpg',
      },
    });
  }

  await prisma.payment.upsert({
    where:  { orderId: ID.order3Assigned },
    update: {},
    create: {
      orderId: ID.order3Assigned,
      method:  PaymentMethod.COD,
      gateway: 'cod',
      amount:  new Prisma.Decimal('948.00'),
      status:  PaymentStatus.SUCCESS,
      paidAt:  new Date('2026-05-20T10:00:00Z'),
    },
  });

  await prisma.delivery.upsert({
    where:  { orderId: ID.order3Assigned },
    update: { status: DeliveryStatus.ASSIGNED },
    create: {
      orderId:    ID.order3Assigned,
      type:       DeliveryType.SELF,
      agentId:    ID.agentProfile,
      status:     DeliveryStatus.ASSIGNED,
      estimatedAt: new Date('2026-05-22T14:00:00Z'),
      locationLog: [],
    },
  });

  // ── ORDER 4: DELIVERED via THIRD_PARTY (Shiprocket) ──

  await prisma.order.upsert({
    where:  { id: ID.order4ThirdParty },
    update: { status: OrderStatus.DELIVERED },
    create: {
      id:            ID.order4ThirdParty,
      orderNumber:   'ORD-SEED-004',
      userId:        ID.customerUser,
      addressId:     ID.customerAddress,
      status:        OrderStatus.DELIVERED,
      subtotal:      new Prisma.Decimal('449.00'),
      discountAmount:new Prisma.Decimal('0.00'),
      shippingCharge:new Prisma.Decimal('49.00'),
      total:         new Prisma.Decimal('498.00'),
      notes:         'Seed order — silver bangle (third party delivery)',
    },
  });

  const items4 = await prisma.orderItem.count({ where: { orderId: ID.order4ThirdParty } });
  if (items4 === 0) {
    await prisma.orderItem.create({
      data: {
        id:        ID.item4a,
        orderId:   ID.order4ThirdParty,
        variantId: ID.varBangle24,
        name:      'Silver Filigree Ethnic Bangle',
        sku:       'BNG-SLV-FLG-24',
        price:     new Prisma.Decimal('449.00'),
        quantity:  1,
        image:     'https://res.cloudinary.com/demo/image/upload/jewellery/bangles/silver-filigree-ethnic.jpg',
      },
    });
  }

  await prisma.payment.upsert({
    where:  { orderId: ID.order4ThirdParty },
    update: {},
    create: {
      orderId:         ID.order4ThirdParty,
      method:          PaymentMethod.NETBANKING,
      gateway:         'razorpay',
      razorpayOrderId: 'order_seed_004_rzp',
      razorpayPayId:   'pay_seed_004_rzp',
      amount:          new Prisma.Decimal('498.00'),
      status:          PaymentStatus.SUCCESS,
      paidAt:          new Date('2026-05-08T15:00:00Z'),
    },
  });

  await prisma.delivery.upsert({
    where:  { orderId: ID.order4ThirdParty },
    update: {},
    create: {
      orderId:    ID.order4ThirdParty,
      type:       DeliveryType.THIRD_PARTY,
      provider:   'shiprocket',
      awbCode:    'SR1234567890',
      trackingUrl:'https://shiprocket.co/tracking/SR1234567890',
      status:     DeliveryStatus.DELIVERED,
      estimatedAt:new Date('2026-05-10T18:00:00Z'),
      deliveredAt:new Date('2026-05-10T14:30:00Z'),
      locationLog: [],
    },
  });

  // ── ORDER 5: PENDING (Razorpay, awaiting payment verification) ──

  await prisma.order.upsert({
    where:  { id: ID.order5Pending },
    update: { status: OrderStatus.PENDING },
    create: {
      id:            ID.order5Pending,
      orderNumber:   'ORD-SEED-005',
      userId:        ID.customerUser,
      addressId:     ID.customerAddress,
      status:        OrderStatus.PENDING,
      subtotal:      new Prisma.Decimal('749.00'),
      discountAmount:new Prisma.Decimal('0.00'),
      shippingCharge:new Prisma.Decimal('49.00'),
      total:         new Prisma.Decimal('798.00'),
      notes:         'Seed order — kundan pendant (pending payment)',
    },
  });

  const items5 = await prisma.orderItem.count({ where: { orderId: ID.order5Pending } });
  if (items5 === 0) {
    await prisma.orderItem.create({
      data: {
        id:        ID.item5a,
        orderId:   ID.order5Pending,
        variantId: ID.varPendant,
        name:      'Kundan Floral Statement Pendant',
        sku:       'PND-KND-FLR',
        price:     new Prisma.Decimal('749.00'),
        quantity:  1,
        image:     'https://res.cloudinary.com/demo/image/upload/jewellery/pendants/kundan-floral.jpg',
      },
    });
  }

  await prisma.payment.upsert({
    where:  { orderId: ID.order5Pending },
    update: {},
    create: {
      orderId:         ID.order5Pending,
      method:          PaymentMethod.UPI,
      gateway:         'razorpay',
      razorpayOrderId: 'order_seed_005_rzp',
      amount:          new Prisma.Decimal('798.00'),
      status:          PaymentStatus.PENDING,
    },
  });

  await prisma.delivery.upsert({
    where:  { orderId: ID.order5Pending },
    update: {},
    create: {
      orderId:    ID.order5Pending,
      type:       DeliveryType.SELF,
      status:     DeliveryStatus.PENDING,
      locationLog: [],
    },
  });
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

async function seedReviews() {
  console.log('  → Reviews');

  await prisma.review.upsert({
    where: {
      userId_orderId_productId: {
        userId:    ID.customerUser,
        orderId:   ID.order1Delivered,
        productId: ID.prodRing,
      },
    },
    update: {},
    create: {
      id:        ID.review1,
      productId: ID.prodRing,
      userId:    ID.customerUser,
      orderId:   ID.order1Delivered,
      rating:    5,
      title:     'Absolutely Beautiful!',
      body:      'The ring is stunning. The gold plating is thick and doesn\'t tarnish. Wore it to a wedding and got so many compliments. Size 6 fits perfectly. Will definitely buy again!',
      images:    [],
      isVisible: true,
    },
  });
}

// ─── Notifications ────────────────────────────────────────────────────────────

async function seedNotifications() {
  console.log('  → Notifications');

  const notifications = [
    {
      id:     ID.notif1,
      userId: ID.customerUser,
      type:   NotificationType.ORDER,
      title:  'Order Placed Successfully!',
      body:   'Your order ORD-SEED-003 for ₹948.00 has been placed. We\'ll confirm it shortly.',
      data:   { orderId: ID.order3Assigned, orderNumber: 'ORD-SEED-003' } as Prisma.InputJsonValue,
      isRead: false,
    },
    {
      id:     ID.notif2,
      userId: ID.customerUser,
      type:   NotificationType.DELIVERY,
      title:  'Your Delivery is Here!',
      body:   `Order ORD-SEED-002 is out for delivery. Your OTP is: ${SEED_OTP}. Share only with the agent.`,
      data:   { orderId: ID.order2OutForDelivery, otp: SEED_OTP } as Prisma.InputJsonValue,
      isRead: false,
    },
    {
      id:     ID.notif3,
      userId: ID.customerUser,
      type:   NotificationType.ORDER,
      title:  'Order ORD-SEED-001: DELIVERED',
      body:   'Your order has been delivered. Enjoy your jewellery!',
      data:   { orderId: ID.order1Delivered, status: 'DELIVERED' } as Prisma.InputJsonValue,
      isRead: true,
    },
    {
      id:     ID.notif4,
      userId: ID.customerUser,
      type:   NotificationType.OFFER,
      title:  'New Offer: WELCOME10',
      body:   '10% off on your first order. Valid until Dec 2027.',
      data:   { couponCode: 'WELCOME10' } as Prisma.InputJsonValue,
      isRead: false,
    },
  ];

  for (const notif of notifications) {
    await prisma.notification.upsert({
      where:  { id: notif.id },
      update: {},
      create: notif,
    });
  }
}

// ─── Print Summary ────────────────────────────────────────────────────────────

function printSeedSummary() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  SEED DATA SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('  CREDENTIALS');
  console.log(`  Admin     → email: ${SEED_CREDS.admin.email}    pw: ${SEED_CREDS.admin.password}`);
  console.log(`  Customer  → phone: ${SEED_CREDS.customer.phone}  pw: ${SEED_CREDS.customer.password}`);
  console.log(`  Agent     → phone: ${SEED_CREDS.agent.phone}  pw: ${SEED_CREDS.agent.password}`);
  console.log('');
  console.log('  STABLE IDs (copy into Postman environment)');
  console.log(`  adminUserId       : ${ID.adminUser}`);
  console.log(`  customerUserId    : ${ID.customerUser}`);
  console.log(`  agentUserId       : ${ID.agentUser}`);
  console.log(`  agentProfileId    : ${ID.agentProfile}`);
  console.log(`  productRingId     : ${ID.prodRing}`);
  console.log(`  productNecklaceId : ${ID.prodNecklace}`);
  console.log(`  variantRingS6Id   : ${ID.varRingS6}`);
  console.log(`  variantNecklaceId : ${ID.varNecklace16}`);
  console.log(`  order1DeliveredId : ${ID.order1Delivered}  (DELIVERED, review-ready)`);
  console.log(`  order2OtpId       : ${ID.order2OutForDelivery}  (OUT_FOR_DELIVERY, OTP = ${SEED_OTP})`);
  console.log(`  order3AssignedId  : ${ID.order3Assigned}  (ASSIGNED, run full flow)`);
  console.log(`  order4ThirdPartyId: ${ID.order4ThirdParty}  (DELIVERED, THIRD_PARTY)`);
  console.log(`  order5PendingId   : ${ID.order5Pending}  (PENDING, Razorpay)`);
  console.log('');
  console.log('  COUPONS');
  console.log('  WELCOME10  → 10% off, min ₹500, max discount ₹200, active');
  console.log('  FLAT100    → ₹100 flat, min ₹800, active');
  console.log('  EXPIRED50  → inactive/expired (for negative tests)');
  console.log('');
  console.log('  OTP for ORDER_2: 482910');
  console.log('  Razorpay order_id for ORDER_5: order_seed_005_rzp');
  console.log('═══════════════════════════════════════════════════════\n');
}

// ─── Run ──────────────────────────────────────────────────────────────────────

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
