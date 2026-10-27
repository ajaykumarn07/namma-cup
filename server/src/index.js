import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { openDb } from './db.js';
import { seedProducts, seedAdmin, migratePricesToInr } from './seed.js';
import { createApp } from './app.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const db = openDb(config.dbPath);
seedProducts(db);
migratePricesToInr(db);
seedAdmin(db);

const staticDir = process.env.CLIENT_DIST || path.resolve(here, '../../client/dist');
const app = createApp(db, { staticDir });
const server = app.listen(config.port, () => console.log(`\u0CA8amma Cup listening on :${config.port}`));

const shutdown = () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
