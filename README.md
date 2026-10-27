# ನamma Cup — coffee ordering app

React (Vite) front end + Node/Express API + SQLite. One container, one volume.

**Features:** menu with search and categories · product detail with sizes · cart · checkout (delivery or pickup, cash) ·
order history with live status tracking · email/password accounts · admin dashboard (manage menu, update order status).

## Run locally (development)

The server reads environment settings from the root `.env` file. The checked-in `.env.example` is a template; it is safe to leave `ADMIN_PASSWORD` blank locally, in which case a new database gets a randomly generated admin password printed once in the server console. Existing admin credentials are not changed by environment settings.

```bash
npm run install:all
npm run dev:server     # API on :3000
npm run dev:client     # UI on http://localhost:5173 (proxies /api to :3000)
```

On first boot the server seeds a sample menu and creates an admin account. With no `ADMIN_PASSWORD` set, a random
password is printed once in the server console. Admin email defaults to `admin@embercup.local`.

```bash
npm test               # API tests (auth, pricing, permissions)
```

## Deploy (Docker on any VPS)

1. Point your domain's DNS A record at the server. Install Docker + Compose.
2. `cp .env.example .env`, then set `DOMAIN`, `JWT_SECRET` (`openssl rand -hex 32`), `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
3. `docker compose up -d --build`
4. Open `https://your-domain`, sign in at `/login` with the admin account, manage the menu under **Admin**.

Caddy obtains and renews the HTTPS certificate automatically. Data lives in the `embercup-data` volume.

**Backup:** copy the `embercup-data` volume, or run `docker compose exec embercup node -e "const D=require('better-sqlite3');new D('/data/embercup.db').backup('/data/backup.db')"` and download `/data/backup.db`.

**Update:** `git pull && docker compose up -d --build`

No domain / no HTTPS (testing only): run `docker build -t embercup . && docker run -p 3000:3000 -e JWT_SECRET=test -e COOKIE_SECURE=false -v embercup:/data embercup`.

## Known limits (read before real customers)

- **No online payments.** Orders are cash on delivery/pickup. Adding Stripe means a payment-intent endpoint plus a webhook that marks orders paid.
- **No password reset / email verification.** Needs an email provider.
- **SQLite, single instance.** Fine for one shop; do not run multiple replicas on the same file.
- **Live tracking is polling (8 s)**, not websockets.
- **Menu illustrations are built-in SVGs.** There is no image upload; add object storage if you want real photos.
- **No order notifications** to staff; the admin page refreshes every 10 s while open.
- Prices are in Indian rupees (INR); tax is not calculated.
