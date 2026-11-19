# Shuka — Local Armenian Marketplace

Single-process Node.js + Express + SQLite (`STRICT` mode, WAL) + React + Tailwind CSS marketplace with cash-on-delivery checkout, multi-seller order splitting, strict fulfillment state machine, and safe image processing.

## Quick Start

```bash
npm install
npm run dev
```

`npm run dev` builds the React SPA (`vite build`) and starts the Express server on `http://localhost:3000`, automatically applying SQLite migrations and seeding the demo catalog if empty.

For production after building:

```bash
npm run build
npm start
```

## Demo Credentials

### Buyers
| Name | Email | Password |
| --- | --- | --- |
| Narek Petrosyan | `narek@demo.am` | `Buyer123!` |
| Mariam Avetisyan | `mariam@demo.am` | `Buyer123!` |

### Sellers
| Store Name | Email | Password |
| --- | --- | --- |
| Yerevan Tech Hub | `aram@yerevantech.am` | `Seller123!` |
| Ararat Home & Style | `ani@ararathome.am` | `Seller123!` |
| Hayk Outdoor & Auto | `tigran@haykgear.am` | `Seller123!` |

## Environment Variables

- `PORT` — HTTP server port (default `3000`)
- `DATA_DIR` — Directory holding `shuka.db`, `uploads/`, and `backups/` (default `./data`)
- `SESSION_SECRET` — HMAC-SHA256 cookie signing secret (dev fallback locally, **required** when `NODE_ENV=production`)
- `NODE_ENV` — Set to `production` in deployment (`Secure` cookie flag)

## Scripts

- `npm run migrate` — Apply SQLite migrations (`server/migrations/`)
- `npm run seed` — Idempotently populate categories, demo users, 42 products, local WebP images, and sample order/reviews
- `npm run backup` — Create a consistent online SQLite backup via `VACUUM INTO` in `${DATA_DIR}/backups/`
- `npm run test:break-it` — Run the 9 automated adversarial edge-case tests (`node scripts/break-it.mjs [baseUrl]`)

## Render Deployment

A ready `render.yaml` is included in the repository root:
- Web Service (Node runtime)
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Persistent disk mounted at `/var/data` with `DATA_DIR=/var/data`
