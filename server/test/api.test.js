import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { seedProducts, migratePricesToInr } from '../src/seed.js';
import { createApp } from '../src/app.js';
import bcrypt from 'bcryptjs';

let server, base, db;

before(async () => {
  db = openDb(':memory:');
  seedProducts(db);
  db.prepare(`INSERT INTO users (name,email,password_hash,role) VALUES ('Admin','admin@t.dev',?, 'admin')`).run(bcrypt.hashSync('adminpass123', 4));
  server = createApp(db, { authLimit: 1000 }).listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());

// Minimal cookie-jar client
function client() {
  let cookie = '';
  return async (method, url, body) => {
    const res = await fetch(base + url, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, body: await res.json().catch(() => null) };
  };
}

test('menu lists products, filters and searches', async () => {
  const c = client();
  const all = await c('GET', '/products');
  assert.equal(all.status, 200);
  assert.ok(all.body.products.length >= 10);
  const iced = await c('GET', '/products?category=Iced');
  assert.ok(iced.body.products.every((p) => p.category === 'Iced'));
  const s = await c('GET', '/products?q=mocha');
  assert.equal(s.body.products.length, 1);
  const wild = await c('GET', '/products?q=%25');
  assert.equal(wild.body.products.length, 0, 'LIKE wildcards must be escaped');
});

test('register, me, logout, login', async () => {
  const c = client();
  const weak = await c('POST', '/auth/register', { name: 'A', email: 'a@t.dev', password: 'short' });
  assert.equal(weak.status, 400);
  const r = await c('POST', '/auth/register', { name: 'Ann', email: 'Ann@T.dev', password: 'password123' });
  assert.equal(r.status, 201);
  assert.equal(r.body.user.role, 'customer');
  assert.equal((await c('GET', '/auth/me')).body.user.email, 'ann@t.dev');
  const dup = await c('POST', '/auth/register', { name: 'Ann', email: 'ann@t.dev', password: 'password123' });
  assert.equal(dup.status, 409);
  const bad = await client()('POST', '/auth/login', { email: 'ann@t.dev', password: 'wrongwrong' });
  assert.equal(bad.status, 401);
  const c2 = client();
  assert.equal((await c2('POST', '/auth/login', { email: 'ann@t.dev', password: 'password123' })).status, 200);
});

test('one-time INR migration reprices existing orders from current menu prices', () => {
  const legacyDb = openDb(':memory:');
  seedProducts(legacyDb);
  const user = legacyDb.prepare(
    `INSERT INTO users (name,email,password_hash) VALUES ('Legacy','legacy@t.dev','hash')`
  ).run();
  const mocha = legacyDb.prepare(`SELECT id, price_cents FROM products WHERE name = 'Caffè Mocha'`).get();
  const croissant = legacyDb.prepare(`SELECT id, price_cents FROM products WHERE name = 'Butter Croissant'`).get();
  const orderId = legacyDb.prepare(
    `INSERT INTO orders (user_id, delivery_type, subtotal_cents, delivery_fee_cents, total_cents, currency)
     VALUES (?, 'delivery', 999, 150, 1149, 'USD')`
  ).run(user.lastInsertRowid).lastInsertRowid;
  const insertItem = legacyDb.prepare(
    'INSERT INTO order_items (order_id, product_id, name, size, unit_price_cents, qty) VALUES (?,?,?,?,?,?)'
  );
  insertItem.run(orderId, mocha.id, 'Caffè Mocha', 'M', 513, 1);
  insertItem.run(orderId, croissant.id, 'Butter Croissant', 'L', 430, 1);

  assert.equal(migratePricesToInr(legacyDb), true);
  const order = legacyDb.prepare('SELECT subtotal_cents, delivery_fee_cents, total_cents, currency FROM orders WHERE id = ?').get(orderId);
  assert.deepEqual(order, { subtotal_cents: 43000, delivery_fee_cents: 3000, total_cents: 46000, currency: 'INR' });
  assert.deepEqual(
    legacyDb.prepare('SELECT unit_price_cents FROM order_items WHERE order_id = ? ORDER BY id').all(orderId),
    [{ unit_price_cents: 26000 }, { unit_price_cents: 17000 }]
  );
  assert.equal(migratePricesToInr(legacyDb), false);
  legacyDb.close();
});

test('changing password requires authentication and the current password', async () => {
  const unauthenticated = await client()('POST', '/auth/change-password', {
    currentPassword: 'password123',
    newPassword: 'newpassword123',
  });
  assert.equal(unauthenticated.status, 401);

  const c = client();
  await c('POST', '/auth/register', { name: 'Pat', email: 'pat@t.dev', password: 'password123' });
  assert.equal((await c('POST', '/auth/change-password', {
    currentPassword: 'wrongpassword',
    newPassword: 'newpassword123',
  })).status, 400);
  assert.equal((await c('POST', '/auth/change-password', {
    currentPassword: 'password123',
    newPassword: 'short',
  })).status, 400);
  assert.equal((await c('POST', '/auth/change-password', {
    currentPassword: 'password123',
    newPassword: 'password123',
  })).status, 400);
  assert.equal((await c('POST', '/auth/change-password', {
    currentPassword: 'password123',
    newPassword: 'newpassword123',
  })).status, 200);
  assert.equal((await client()('POST', '/auth/login', {
    email: 'pat@t.dev',
    password: 'password123',
  })).status, 401);
  assert.equal((await client()('POST', '/auth/login', {
    email: 'pat@t.dev',
    password: 'newpassword123',
  })).status, 200);
});

test('orders require auth and prices are computed server-side', async () => {
  assert.equal((await client()('POST', '/orders', { items: [], deliveryType: 'pickup' })).status, 401);
  const c = client();
  await c('POST', '/auth/register', { name: 'Bob', email: 'bob@t.dev', password: 'password123' });
  const menu = (await c('GET', '/products')).body.products;
  const mocha = menu.find((p) => p.name === 'Caffè Mocha');

  // A client-supplied price must be ignored
  const res = await c('POST', '/orders', {
    items: [{ productId: mocha.id, size: 'L', qty: 1, priceCents: 1 }],
    deliveryType: 'delivery',
    address: '12 Main Street',
  });
  assert.equal(res.status, 201);
  const o = res.body.order;
  assert.equal(o.subtotalCents, mocha.priceCents + 4000);
  assert.equal(o.deliveryFeeCents, 3000);
  assert.equal(o.currency, 'INR');
  assert.equal(o.totalCents, o.subtotalCents + 3000);

  const noAddr = await c('POST', '/orders', { items: [{ productId: mocha.id, size: 'S', qty: 1 }], deliveryType: 'delivery' });
  assert.equal(noAddr.status, 400);
  const badQty = await c('POST', '/orders', { items: [{ productId: mocha.id, size: 'S', qty: 0 }], deliveryType: 'pickup' });
  assert.equal(badQty.status, 400);
  const ghost = await c('POST', '/orders', { items: [{ productId: 99999, size: 'S', qty: 1 }], deliveryType: 'pickup' });
  assert.equal(ghost.status, 400);

  const mine = await c('GET', '/orders');
  assert.equal(mine.body.orders.length, 1);
});

test('users cannot see or cancel other users orders; cancel rules', async () => {
  const a = client(), b = client();
  await a('POST', '/auth/register', { name: 'A', email: 'oa@t.dev', password: 'password123' });
  await b('POST', '/auth/register', { name: 'B', email: 'ob@t.dev', password: 'password123' });
  const pid = (await a('GET', '/products')).body.products[0].id;
  const order = (await a('POST', '/orders', { items: [{ productId: pid, size: 'M', qty: 1 }], deliveryType: 'pickup' })).body.order;
  assert.equal((await b('GET', `/orders/${order.id}`)).status, 404);
  assert.equal((await b('POST', `/orders/${order.id}/cancel`)).status, 404);
  assert.equal((await a('POST', `/orders/${order.id}/cancel`)).body.order.status, 'cancelled');
  assert.equal((await a('POST', `/orders/${order.id}/cancel`)).status, 409);
});

test('admin routes are protected; admin can manage menu and order status', async () => {
  const cust = client();
  await cust('POST', '/auth/register', { name: 'C', email: 'c@t.dev', password: 'password123' });
  assert.equal((await cust('GET', '/admin/orders')).status, 403);
  assert.equal((await client()('GET', '/admin/orders')).status, 401);
  // Role cannot be self-assigned at registration
  const sneaky = await client()('POST', '/auth/register', { name: 'S', email: 's@t.dev', password: 'password123', role: 'admin' });
  assert.equal(sneaky.body.user.role, 'customer');

  const admin = client();
  assert.equal((await admin('POST', '/auth/login', { email: 'admin@t.dev', password: 'adminpass123' })).status, 200);
  const created = await admin('POST', '/admin/products', { name: 'Test Brew', category: 'Iced', art: 'iced', priceCents: 500 });
  assert.equal(created.status, 201);
  const id = created.body.product.id;
  assert.equal((await admin('PUT', `/admin/products/${id}`, { name: 'Test Brew', category: 'Iced', art: 'iced', priceCents: 550, available: false })).body.product.available, false);
  assert.equal((await client()('GET', `/products/${id}`)).status, 404, 'unavailable products are hidden');
  assert.equal((await admin('DELETE', `/admin/products/${id}`)).status, 200);

  const pid = (await cust('GET', '/products')).body.products[0].id;
  const order = (await cust('POST', '/orders', { items: [{ productId: pid, size: 'S', qty: 1 }], deliveryType: 'pickup' })).body.order;
  const st = await admin('PATCH', `/admin/orders/${order.id}/status`, { status: 'preparing' });
  assert.equal(st.body.order.status, 'preparing');
  assert.equal((await admin('PATCH', `/admin/orders/${order.id}/status`, { status: 'bogus' })).status, 400);
  assert.equal((await cust('POST', `/orders/${order.id}/cancel`)).status, 409);
});
