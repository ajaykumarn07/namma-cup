import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL,
      art TEXT NOT NULL DEFAULT 'latte',
      price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
      rating REAL NOT NULL DEFAULT 4.5,
      available INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'placed',
      delivery_type TEXT NOT NULL CHECK (delivery_type IN ('delivery','pickup')),
      address TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      payment_method TEXT NOT NULL DEFAULT 'cash',
      subtotal_cents INTEGER NOT NULL,
      delivery_fee_cents INTEGER NOT NULL,
      total_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      size TEXT NOT NULL,
      unit_price_cents INTEGER NOT NULL,
      qty INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const orderColumns = db.pragma('table_info(orders)');
  if (!orderColumns.some((column) => column.name === 'currency')) {
    db.exec("ALTER TABLE orders ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD'");
  }
  return db;
}
