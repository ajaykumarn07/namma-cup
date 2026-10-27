import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { config, SIZES, DELIVERY_FEE_CENTS, FREE_DELIVERY_OVER_CENTS, ORDER_STATUSES } from './config.js';

const COOKIE = 'ec_token';
const ART = ['latte', 'mocha', 'espresso', 'cappuccino', 'iced', 'frappe', 'tea', 'matcha', 'croissant', 'muffin'];

const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function parse(schema, data) {
  const r = schema.safeParse(data);
  if (!r.success) {
    const msg = r.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
    throw new HttpError(400, msg);
  }
  return r.data;
}

const productOut = (p) => ({
  id: p.id,
  name: p.name,
  subtitle: p.subtitle,
  description: p.description,
  category: p.category,
  art: p.art,
  priceCents: p.price_cents,
  rating: p.rating,
  available: !!p.available,
});

export function createApp(db, { staticDir, authLimit = 30 } = {}) {
  const app = express();
  if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: null, // HTTPS is terminated by the proxy; this would break plain-HTTP testing
        },
      },
    })
  );
  app.use(express.json({ limit: '50kb' }));
  app.use(cookieParser());

  // ---------- auth helpers ----------
  const issue = (res, user) => {
    const token = jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: '7d' });
    res.cookie(COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.cookieSecure,
      maxAge: 7 * 24 * 3600 * 1000,
    });
  };
  const userOut = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

  const loadUser = (req, _res, next) => {
    const token = req.cookies?.[COOKIE];
    if (token) {
      try {
        const { sub } = jwt.verify(token, config.jwtSecret);
        req.user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(sub);
      } catch {
        /* invalid/expired token: treat as logged out */
      }
    }
    next();
  };
  const requireAuth = (req, _res, next) => (req.user ? next() : next(new HttpError(401, 'Please sign in.')));
  const requireAdmin = (req, _res, next) =>
    !req.user ? next(new HttpError(401, 'Please sign in.')) : req.user.role !== 'admin' ? next(new HttpError(403, 'Admins only.')) : next();
  app.use(loadUser);

  const api = express.Router();
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: authLimit, standardHeaders: true, legacyHeaders: false });

  api.get('/health', (_req, res) => res.json({ ok: true }));

  // ---------- auth ----------
  const registerSchema = z.object({
    name: z.string().trim().min(1).max(80),
    email: z.string().trim().toLowerCase().email().max(200),
    password: z.string().min(8, 'at least 8 characters').max(200),
  });
  api.post(
    '/auth/register',
    authLimiter,
    asyncH(async (req, res) => {
      const { name, email, password } = parse(registerSchema, req.body);
      if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw new HttpError(409, 'That email is already registered.');
      const hash = await bcrypt.hash(password, 10);
      const info = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?,?,?)').run(name, email, hash);
      const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(info.lastInsertRowid);
      issue(res, user);
      res.status(201).json({ user: userOut(user) });
    })
  );
  const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });
  api.post(
    '/auth/login',
    authLimiter,
    asyncH(async (req, res) => {
      const { email, password } = parse(loginSchema, req.body);
      const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      // Always run a hash compare so timing does not reveal whether the email exists.
      const ok = await bcrypt.compare(password, row?.password_hash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi');
      if (!row || !ok) throw new HttpError(401, 'Incorrect email or password.');
      issue(res, row);
      res.json({ user: userOut(row) });
    })
  );
  const changePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, 'at least 8 characters').max(200),
  });
  api.post(
    '/auth/change-password',
    requireAuth,
    authLimiter,
    asyncH(async (req, res) => {
      const { currentPassword, newPassword } = parse(changePasswordSchema, req.body);
      const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
      const matches = await bcrypt.compare(currentPassword, row.password_hash);
      if (!matches) throw new HttpError(400, 'Current password is incorrect.');
      if (currentPassword === newPassword) throw new HttpError(400, 'New password must be different from your current password.');
      const passwordHash = await bcrypt.hash(newPassword, 10);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, req.user.id);
      res.json({ ok: true });
    })
  );
  api.post('/auth/logout', (_req, res) => {
    res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure });
    res.json({ ok: true });
  });
  api.get('/auth/me', (req, res) => res.json({ user: req.user ? userOut(req.user) : null }));

  // ---------- menu ----------
  api.get('/categories', (_req, res) => {
    const rows = db.prepare('SELECT category FROM products WHERE available = 1 GROUP BY category ORDER BY MIN(id)').all();
    res.json({ categories: rows.map((r) => r.category) });
  });
  api.get('/products', (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : '';
    const category = typeof req.query.category === 'string' ? req.query.category : '';
    const where = ['available = 1'];
    const args = [];
    if (category) { where.push('category = ?'); args.push(category); }
    if (q) {
      where.push(`(name LIKE ? ESCAPE '\\' OR subtitle LIKE ? ESCAPE '\\')`);
      const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
      args.push(like, like);
    }
    const rows = db.prepare(`SELECT * FROM products WHERE ${where.join(' AND ')} ORDER BY id`).all(...args);
    res.json({ products: rows.map(productOut), sizes: SIZES });
  });
  api.get('/products/:id', (req, res) => {
    const p = db.prepare('SELECT * FROM products WHERE id = ? AND available = 1').get(Number(req.params.id));
    if (!p) throw new HttpError(404, 'Product not found.');
    res.json({ product: productOut(p), sizes: SIZES });
  });
  api.get('/config', (_req, res) =>
    res.json({ sizes: SIZES, deliveryFeeCents: DELIVERY_FEE_CENTS, freeDeliveryOverCents: FREE_DELIVERY_OVER_CENTS })
  );

  // ---------- orders ----------
  const orderSchema = z
    .object({
      items: z
        .array(z.object({ productId: z.number().int().positive(), size: z.enum(['S', 'M', 'L']), qty: z.number().int().min(1).max(20) }))
        .min(1, 'Your cart is empty')
        .max(40),
      deliveryType: z.enum(['delivery', 'pickup']),
      address: z.string().trim().max(300).default(''),
      note: z.string().trim().max(300).default(''),
      paymentMethod: z.literal('cash').default('cash'),
    })
    .refine((o) => o.deliveryType === 'pickup' || o.address.length >= 5, { message: 'Delivery address is required', path: ['address'] });

  const loadOrder = (id) => {
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!o) return null;
    const items = db.prepare('SELECT id, product_id, name, size, unit_price_cents, qty FROM order_items WHERE order_id = ? ORDER BY id').all(id);
    return {
      id: o.id,
      userId: o.user_id,
      status: o.status,
      deliveryType: o.delivery_type,
      address: o.address,
      note: o.note,
      paymentMethod: o.payment_method,
      subtotalCents: o.subtotal_cents,
      deliveryFeeCents: o.delivery_fee_cents,
      totalCents: o.total_cents,
      currency: o.currency,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
      items: items.map((i) => ({ id: i.id, productId: i.product_id, name: i.name, size: i.size, unitPriceCents: i.unit_price_cents, qty: i.qty })),
    };
  };

  api.post(
    '/orders',
    requireAuth,
    asyncH(async (req, res) => {
      const body = parse(orderSchema, req.body);
      const create = db.transaction(() => {
        let subtotal = 0;
        const lines = body.items.map((it) => {
          const p = db.prepare('SELECT * FROM products WHERE id = ?').get(it.productId);
          if (!p || !p.available) throw new HttpError(400, `An item in your cart is no longer available.`);
          // Price is always computed here; the client's idea of the price is never trusted.
          const unit = p.price_cents + SIZES[it.size];
          subtotal += unit * it.qty;
          return { p, size: it.size, qty: it.qty, unit };
        });
        const fee = body.deliveryType === 'delivery' && subtotal < FREE_DELIVERY_OVER_CENTS ? DELIVERY_FEE_CENTS : 0;
        const info = db
          .prepare(
            `INSERT INTO orders (user_id, delivery_type, address, note, payment_method, subtotal_cents, delivery_fee_cents, total_cents, currency)
             VALUES (?,?,?,?,?,?,?,?, 'INR')`
          )
          .run(req.user.id, body.deliveryType, body.deliveryType === 'delivery' ? body.address : '', body.note, body.paymentMethod, subtotal, fee, subtotal + fee);
        const ins = db.prepare('INSERT INTO order_items (order_id, product_id, name, size, unit_price_cents, qty) VALUES (?,?,?,?,?,?)');
        for (const l of lines) ins.run(info.lastInsertRowid, l.p.id, l.p.name, l.size, l.unit, l.qty);
        return Number(info.lastInsertRowid);
      });
      res.status(201).json({ order: loadOrder(create()) });
    })
  );
  api.get('/orders', requireAuth, (req, res) => {
    const ids = db.prepare('SELECT id FROM orders WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 100').all(req.user.id);
    res.json({ orders: ids.map((r) => loadOrder(r.id)) });
  });
  api.get('/orders/:id', requireAuth, (req, res) => {
    const o = loadOrder(Number(req.params.id));
    // 404 (not 403) for other people's orders so ids cannot be probed.
    if (!o || (o.userId !== req.user.id && req.user.role !== 'admin')) throw new HttpError(404, 'Order not found.');
    res.json({ order: o });
  });
  api.post('/orders/:id/cancel', requireAuth, (req, res) => {
    const o = loadOrder(Number(req.params.id));
    if (!o || o.userId !== req.user.id) throw new HttpError(404, 'Order not found.');
    if (o.status !== 'placed') throw new HttpError(409, 'This order is already being prepared and can no longer be cancelled.');
    db.prepare(`UPDATE orders SET status='cancelled', updated_at=datetime('now') WHERE id = ?`).run(o.id);
    res.json({ order: loadOrder(o.id) });
  });

  // ---------- admin ----------
  const adminRouter = express.Router();
  adminRouter.use(requireAdmin);
  const productSchema = z.object({
    name: z.string().trim().min(1).max(80),
    subtitle: z.string().trim().max(120).default(''),
    description: z.string().trim().max(600).default(''),
    category: z.string().trim().min(1).max(40),
    art: z.enum(ART),
    priceCents: z.number().int().min(0).max(100000),
    available: z.boolean().default(true),
  });
  adminRouter.get('/products', (_req, res) => {
    res.json({ products: db.prepare('SELECT * FROM products ORDER BY category, id').all().map(productOut), arts: ART });
  });
  adminRouter.post('/products', (req, res) => {
    const b = parse(productSchema, req.body);
    const info = db
      .prepare('INSERT INTO products (name, subtitle, description, category, art, price_cents, available) VALUES (?,?,?,?,?,?,?)')
      .run(b.name, b.subtitle, b.description, b.category, b.art, b.priceCents, b.available ? 1 : 0);
    res.status(201).json({ product: productOut(db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid)) });
  });
  adminRouter.put('/products/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!db.prepare('SELECT 1 FROM products WHERE id = ?').get(id)) throw new HttpError(404, 'Product not found.');
    const b = parse(productSchema, req.body);
    db.prepare('UPDATE products SET name=?, subtitle=?, description=?, category=?, art=?, price_cents=?, available=? WHERE id=?').run(
      b.name, b.subtitle, b.description, b.category, b.art, b.priceCents, b.available ? 1 : 0, id
    );
    res.json({ product: productOut(db.prepare('SELECT * FROM products WHERE id = ?').get(id)) });
  });
  adminRouter.delete('/products/:id', (req, res) => {
    const info = db.prepare('DELETE FROM products WHERE id = ?').run(Number(req.params.id));
    if (!info.changes) throw new HttpError(404, 'Product not found.');
    res.json({ ok: true });
  });
  adminRouter.get('/orders', (_req, res) => {
    const ids = db.prepare('SELECT o.id, u.name AS customer, u.email FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC, o.id DESC LIMIT 200').all();
    res.json({ orders: ids.map((r) => ({ ...loadOrder(r.id), customer: r.customer, email: r.email })) });
  });
  adminRouter.patch('/orders/:id/status', (req, res) => {
    const { status } = parse(z.object({ status: z.enum(ORDER_STATUSES) }), req.body);
    const id = Number(req.params.id);
    const info = db.prepare(`UPDATE orders SET status=?, updated_at=datetime('now') WHERE id=?`).run(status, id);
    if (!info.changes) throw new HttpError(404, 'Order not found.');
    res.json({ order: loadOrder(id) });
  });
  api.use('/admin', adminRouter);

  api.use((_req, _res, next) => next(new HttpError(404, 'Not found.')));
  app.use('/api', api);

  // ---------- static client (production) ----------
  if (staticDir && fs.existsSync(path.join(staticDir, 'index.html'))) {
    app.use('/assets', express.static(path.join(staticDir, 'assets'), { immutable: true, maxAge: '1y' }));
    app.use(express.static(staticDir, { maxAge: '1h', index: false }));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  });
  return app;
}
