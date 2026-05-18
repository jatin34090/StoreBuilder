import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3001),
  API_URL: Joi.string().uri().required(),
  WEB_URL: Joi.string().uri().required(),
  CORS_ORIGINS: Joi.string().required(),

  // Database
  DATABASE_URL: Joi.string().required(),
  DIRECT_URL: Joi.string().required(),

  // Redis
  REDIS_URL: Joi.string().required(),

  // JWT
  JWT_PRIVATE_KEY: Joi.string().required(),
  JWT_PUBLIC_KEY: Joi.string().required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),

  // Razorpay
  RAZORPAY_KEY_ID: Joi.string().required(),
  RAZORPAY_KEY_SECRET: Joi.string().required(),
  RAZORPAY_WEBHOOK_SECRET: Joi.string().required(),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: Joi.string().required(),
  CLOUDINARY_API_KEY: Joi.string().required(),
  CLOUDINARY_API_SECRET: Joi.string().required(),

  // MSG91
  MSG91_AUTH_KEY: Joi.string().required(),
  MSG91_TEMPLATE_ID_OTP: Joi.string().required(),
  MSG91_SENDER_ID: Joi.string().required(),

  // Resend
  RESEND_API_KEY: Joi.string().required(),
  RESEND_FROM_EMAIL: Joi.string().email().required(),
  RESEND_FROM_NAME: Joi.string().required(),

  // Google OAuth
  GOOGLE_CLIENT_ID: Joi.string().required(),
  GOOGLE_CLIENT_SECRET: Joi.string().required(),
  GOOGLE_CALLBACK_URL: Joi.string().uri().required(),

  // Typesense
  TYPESENSE_HOST: Joi.string().required(),
  TYPESENSE_PORT: Joi.string().default('443'),
  TYPESENSE_PROTOCOL: Joi.string().default('https'),
  TYPESENSE_API_KEY: Joi.string().required(),

  // Shiprocket
  SHIPROCKET_EMAIL: Joi.string().email().required(),
  SHIPROCKET_PASSWORD: Joi.string().required(),
  SHIPROCKET_PICKUP_PINCODE: Joi.string().required(),

  // Delhivery
  DELHIVERY_API_TOKEN: Joi.string().required(),
  DELHIVERY_CLIENT_NAME: Joi.string().required(),
  DELHIVERY_PICKUP_PINCODE: Joi.string().required(),

  // VAPID
  VAPID_PUBLIC_KEY: Joi.string().required(),
  VAPID_PRIVATE_KEY: Joi.string().required(),
  VAPID_SUBJECT: Joi.string().required(),

  // Admin
  ADMIN_EMAIL: Joi.string().email().required(),
  ADMIN_PASSWORD: Joi.string().min(16).required(),
});
