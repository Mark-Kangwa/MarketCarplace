# Pazengo — Zambian vehicle marketplace

Marketplace for cars, motorbikes, boats and trucks: public listings with AutoTrader-style search, user sell flow, admin console for inventory, users, and manual EFT payment approvals.

## Quick start

1. Copy env: `cp .env.example .env` and set `DATABASE_URL` (Neon/Supabase or local docker), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SESSION_SECRET`.
2. `npm install`
3. `npm run db:push && npm run db:seed`
4. `npm run dev` → `/admin/login`

With docker: `docker compose up -d`, then `DATABASE_URL="postgresql://carmarket:carmarket@localhost:5432/carmarketplace?schema=public"`.

With system Postgres (permanent, needs sudo in your own terminal):
```bash
sudo apt-get update && sudo apt-get install -y postgresql
sudo service postgresql start
sudo -u postgres psql -c "CREATE USER carmarket WITH PASSWORD 'carmarket' SUPERUSER;"
sudo -u postgres psql -c "CREATE DATABASE carmarketplace OWNER carmarket;"
```

Note: this sandbox currently runs Postgres from `/tmp/opencode/pg-runner` (data in `/tmp/opencode/pgdata`,
wiped on reboot). Restart it with `node /tmp/opencode/pg-runner/start.js start`, then re-run `db:push + db:seed` if needed.

## Admin capabilities

- **Dashboard** `/admin` — stock count, pending payments, blocked users, audit trail.
- **Inventory** `/admin/inventory` — add/edit/publish/block/sold, live buyer-card preview. CSV import at `/admin/inventory/import` with dry-run validation.
- **Users** `/admin/users` — search general users + dealers, block with reason / restore access. Blocked users are rejected at login.
- **Payments** `/admin/payments` — pending EFT queue with proof viewer, approve only after money reflects, reject with fix instructions.
- **Audit** `/admin/audit` — every sensitive action recorded.

## Notes

- Auth is a single seeded admin (env credentials, HttpOnly JWT cookie, 12h expiry). Role-based staff comes in phase 2.
- Build never requires a live DB: pages degrade to empty states with setup instructions.
- CSV header: `stock_code,make,model,variant,year,price,mileage,transmission,fuel,body,condition,vin,color`
