import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { config, SIZES, DELIVERY_FEE_CENTS, FREE_DELIVERY_OVER_CENTS } from './config.js';

const MENU = [
  ['Caffè Mocha', 'Espresso, chocolate, steamed milk', 'Espresso with dark chocolate and silky steamed milk, finished with a light cocoa dust.', 'Hot Coffee', 'mocha', 24000, 4.8],
  ['Flat White', 'Double ristretto, micro-foam', 'Two ristretto shots under a thin layer of velvety micro-foam. Strong and smooth.', 'Hot Coffee', 'latte', 20000, 4.7],
  ['Espresso', 'Single origin, double shot', 'A concentrated double shot with a caramel crema. Rotating single-origin beans.', 'Hot Coffee', 'espresso', 13000, 4.6],
  ['Cappuccino', 'Equal parts espresso, milk, foam', 'Classic Italian balance of espresso, steamed milk and a thick cap of foam.', 'Hot Coffee', 'cappuccino', 18000, 4.7],
  ['Vanilla Latte', 'Espresso, vanilla, steamed milk', 'Smooth latte sweetened with house-made vanilla syrup.', 'Hot Coffee', 'latte', 21000, 4.5],
  ['Iced Americano', 'Espresso over cold water and ice', 'Clean, bright and refreshing. Two espresso shots over ice.', 'Iced', 'iced', 15000, 4.4],
  ['Cold Brew', '18-hour steeped, served over ice', 'Slow-steeped for 18 hours. Low acidity, naturally sweet, very smooth.', 'Iced', 'iced', 19000, 4.8],
  ['Caramel Frappe', 'Blended coffee, caramel, cream', 'Blended iced coffee with caramel sauce and whipped cream.', 'Iced', 'frappe', 24000, 4.6],
  ['Masala Chai', 'Spiced black tea with milk', 'Black tea simmered with cardamom, ginger and cinnamon, then milk.', 'Tea', 'tea', 10000, 4.5],
  ['Matcha Latte', 'Ceremonial matcha, steamed milk', 'Stone-ground matcha whisked smooth and topped with steamed milk.', 'Tea', 'matcha', 22000, 4.4],
  ['Butter Croissant', 'Baked every morning', 'Flaky, laminated all-butter croissant. Best with a flat white.', 'Bakery', 'croissant', 13000, 4.7],
  ['Blueberry Muffin', 'Fresh blueberries, crumb top', 'Soft muffin packed with blueberries and a sugar crumb top.', 'Bakery', 'muffin', 12000, 4.3],
];

export function seedProducts(db) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM products').get();
  if (n > 0) return false;
  const ins = db.prepare(
    `INSERT INTO products (name, subtitle, description, category, art, price_cents, rating) VALUES (?,?,?,?,?,?,?)`
  );
  db.transaction(() => MENU.forEach((m) => ins.run(...m)))();
  return true;
}

export function migratePricesToInr(db) {
  const migration = 'reprice-existing-orders-inr-v1';
  if (db.prepare('SELECT 1 FROM schema_migrations WHERE name = ?').get(migration)) return false;
  const updateProduct = db.prepare('UPDATE products SET price_cents = ? WHERE name = ?');
  const updateItem = db.prepare('UPDATE order_items SET unit_price_cents = ? WHERE id = ?');
  const updateOrder = db.prepare(
    `UPDATE orders SET subtotal_cents = ?, delivery_fee_cents = ?, total_cents = ?, currency = 'INR' WHERE id = ?`
  );
  const productPrice = db.prepare('SELECT price_cents FROM products WHERE id = ?');
  const productByName = db.prepare('SELECT price_cents FROM products WHERE name = ?');
  const orderItems = db.prepare('SELECT id, product_id, name, size, unit_price_cents, qty FROM order_items WHERE order_id = ?');
  const orders = db.prepare("SELECT id, delivery_type FROM orders WHERE currency = 'USD'");
  const recordMigration = db.prepare('INSERT INTO schema_migrations (name) VALUES (?)');

  db.transaction(() => {
    for (const [name, , , , , price] of MENU) updateProduct.run(price, name);

    for (const order of orders.all()) {
      let subtotal = 0;
      for (const item of orderItems.all(order.id)) {
        const product = (item.product_id && productPrice.get(item.product_id)) || productByName.get(item.name);
        const unit = product ? product.price_cents + (SIZES[item.size] ?? 0) : item.unit_price_cents;
        updateItem.run(unit, item.id);
        subtotal += unit * item.qty;
      }
      const fee = order.delivery_type === 'delivery' && subtotal < FREE_DELIVERY_OVER_CENTS ? DELIVERY_FEE_CENTS : 0;
      updateOrder.run(subtotal, fee, subtotal + fee, order.id);
    }

    recordMigration.run(migration);
  })();
  return true;
}

// Creates the admin account on first boot. If ADMIN_PASSWORD is not set, a random
// one is generated and printed ONCE to the server log.
export function seedAdmin(db) {
  const exists = db.prepare(`SELECT 1 FROM users WHERE role = 'admin' LIMIT 1`).get();
  if (exists) return;
  let password = config.adminPassword;
  let generated = false;
  if (!password) {
    password = crypto.randomBytes(9).toString('base64url');
    generated = true;
  }
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(`INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?, 'admin')`).run(
    'Admin',
    config.adminEmail,
    hash
  );
  console.log(`Admin account created: ${config.adminEmail}`);
  if (generated) console.log(`Generated admin password (shown once): ${password}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { openDb } = await import('./db.js');
  const db = openDb(config.dbPath);
  console.log(seedProducts(db) ? 'Menu seeded.' : 'Menu already present.');
  seedAdmin(db);
}
