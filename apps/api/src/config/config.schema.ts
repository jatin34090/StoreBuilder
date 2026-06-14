import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3001),
  API_URL: Joi.string().uri().required(),
  WEB_URL: Joi.string().uri().required(),
  CORS_ORIGINS: Joi.string().required(),

  // Database — always required
  DATABASE_URL: Joi.string().required(),
  DIRECT_URL: Joi.string().required(),

  // Redis — optional; falls back to in-memory store in dev
  REDIS_URL: Joi.string().optional().default('memory'),

  // JWT — always required
  JWT_PRIVATE_KEY: Joi.string().required(),
  JWT_PUBLIC_KEY: Joi.string().required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),

  // Razorpay — optional in dev
  RAZORPAY_KEY_ID: Joi.string().optional().default('rzp_test_placeholder'),
  RAZORPAY_KEY_SECRET: Joi.string().optional().default('placeholder_secret'),
  RAZORPAY_WEBHOOK_SECRET: Joi.string().optional().default('placeholder_webhook'),

  // Cloudinary — optional in dev
  CLOUDINARY_CLOUD_NAME: Joi.string().optional().default('dev_cloud'),
  CLOUDINARY_API_KEY: Joi.string().optional().default('dev_key'),
  CLOUDINARY_API_SECRET: Joi.string().optional().default('dev_secret'),

  // MSG91 — optional; OTP is logged to console in dev
  MSG91_AUTH_KEY: Joi.string().allow('').optional().default(''),
  MSG91_TEMPLATE_ID_OTP: Joi.string().allow('').optional().default(''),
  MSG91_SENDER_ID: Joi.string().allow('').optional().default('JEWELS'),

  // Resend — optional; emails logged to console in dev
  RESEND_API_KEY: Joi.string().allow('').optional().default(''),
  RESEND_FROM_EMAIL: Joi.string().allow('').optional().default('dev@localhost.in'),
  RESEND_FROM_NAME: Joi.string().allow('').optional().default('Jewellery Dev'),

  // Google OAuth — optional; strategy skipped when missing
  GOOGLE_CLIENT_ID: Joi.string().allow('').optional().default(''),
  GOOGLE_CLIENT_SECRET: Joi.string().allow('').optional().default(''),
  GOOGLE_CALLBACK_URL: Joi.string().allow('').optional().default('http://localhost:3001/api/v1/auth/google/callback'),

  // Typesense — optional; search falls back to Prisma when missing
  TYPESENSE_HOST: Joi.string().allow('').optional().default(''),
  TYPESENSE_PORT: Joi.string().allow('').default('443'),
  TYPESENSE_PROTOCOL: Joi.string().allow('').default('https'),
  TYPESENSE_API_KEY: Joi.string().allow('').optional().default(''),

  // Shiprocket — optional in dev
  SHIPROCKET_EMAIL: Joi.string().allow('').optional().default('dev@localhost.in'),
  SHIPROCKET_PASSWORD: Joi.string().allow('').optional().default('placeholder'),
  SHIPROCKET_PICKUP_PINCODE: Joi.string().allow('').optional().default('110001'),

  // Delhivery — optional in dev
  DELHIVERY_API_TOKEN: Joi.string().allow('').optional().default('placeholder'),
  DELHIVERY_CLIENT_NAME: Joi.string().allow('').optional().default('DevBrand'),
  DELHIVERY_PICKUP_PINCODE: Joi.string().allow('').optional().default('110001'),

  // VAPID web push — optional in dev
  VAPID_PUBLIC_KEY: Joi.string().allow('').optional().default(''),
  VAPID_PRIVATE_KEY: Joi.string().allow('').optional().default(''),
  VAPID_SUBJECT: Joi.string().allow('').optional().default('mailto:dev@localhost.in'),

  // Sentry — optional
  SENTRY_DSN: Joi.string().allow('').optional().default(''),

  // Admin seed credentials
  ADMIN_EMAIL: Joi.string().allow('').optional().default('admin@jewellery.dev'),
  ADMIN_PASSWORD: Joi.string().allow('').optional().default('Admin@Dev1234567!'),

  // Supabase Storage — optional in dev
  SUPABASE_URL: Joi.string().allow('').optional().default(''),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().allow('').optional().default(''),
}).options({ allowUnknown: true });
