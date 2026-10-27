import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET must be set in production (see .env.example).');
  process.exit(1);
}

export const config = {
  isProd,
  port: Number(process.env.PORT) || 3000,
  // In dev, fall back to a random per-process secret (sessions reset on restart).
  jwtSecret: process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex'),
  dbPath: process.env.DB_PATH || fileURLToPath(new URL('../data/embercup.db', import.meta.url)),
  adminEmail: process.env.ADMIN_EMAIL || 'admin@embercup.local',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  // Set COOKIE_SECURE=false only if you serve over plain HTTP (not recommended).
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProd,
};

export const SIZES = { S: 0, M: 2000, L: 4000 }; // price add-on in paise
export const DELIVERY_FEE_CENTS = 3000;
export const FREE_DELIVERY_OVER_CENTS = 50000;
export const ORDER_STATUSES = ['placed', 'preparing', 'ready', 'completed', 'cancelled'];
