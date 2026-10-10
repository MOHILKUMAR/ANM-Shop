# ANM-Shop

An online beauty store for customers in India: skincare, makeup, haircare and body care, with
Razorpay payments, order tracking, reviews, coupons, support tickets and an AI chat assistant,
plus an admin dashboard to run the shop.

- **Live shop:** https://anm-shop.vercel.app
- **API:** https://anm-shop-api.onrender.com
- **Full documentation (architecture, workflows, API and data reference):**
  [docs/ANM-Shop-Project-Documentation.pdf](docs/ANM-Shop-Project-Documentation.pdf)

## What's inside

| Folder | What it is |
| --- | --- |
| `frontend/` | React 19 + Vite 8 + Tailwind CSS 4 storefront and admin dashboard, hosted on Vercel |
| `backend/` | Node 22 + Express 5 + Mongoose 9 REST API, hosted on Render |
| `docs/` | Project documentation (PDF) |
| `render.yaml` | Render blueprint for the API |

**Services:** MongoDB Atlas (database, needs a replica set for transactions), Razorpay
(payments and refunds), Cloudinary (product photos), Google Gemini (chat assistant), Resend or
Gmail (email), Vercel Web Analytics and Speed Insights (only after the visitor consents).

### Features

- **Shopping:** categories managed by admins, relevance-ranked search, product galleries (up to
  6 photos), Bad / Good / Excellent reviews, a per-account cart that refreshes prices and stock.
- **Accounts:** sign-up with an emailed 6-digit code, password change and reset, self-service
  account deletion.
- **Checkout:** prices worked out on the server in paise, ₹49 shipping below ₹499, one coupon
  per order (percentage, fixed, free shipping, buy X get Y), Razorpay Checkout with signature
  checks and a webhook backup.
- **Orders:** history with PDF bills and e-bill emails; customers cancel unshipped orders and
  admins mark returns, both refunded automatically through Razorpay.
- **Support:** tickets with email notices, and a Gemini assistant that reads the customer's own
  orders and payments, finds products and opens tickets.
- **Admin:** sales statistics (India time), products, categories, orders, coupons, reviews,
  tickets, users (roles, Excel export) and search across orders, payments and customers.

## Running it locally

You need Node 22 and a MongoDB connection string (a free Atlas cluster works).

```bash
npm run install:all                 # installs the root tools, backend and frontend
cp backend/.env.example backend/.env
# Fill in at least MONGO_URL and JWT_SECRET; add Razorpay test keys, Cloudinary, email and
# Gemini keys for those features (each is explained in the file).
npm run dev                         # API on :5000, shop on :5173 (Vite proxies /api)
```

Optional demo data: `cd backend && npm run seed` adds 44 products (`node seed.js -d` removes
them). Running it again only adds demo products that are missing; it never overwrites changes
made in the dashboard. The 7 default categories are created automatically on first start.

**First admin:** sign up in the shop, put that email in `ADMIN_EMAIL` in `backend/.env`, then run
`cd backend && npm run promote-admin`. After that, admins give other accounts the admin role from
the Users tab.

## Scripts

| Where | Command | Does |
| --- | --- | --- |
| root | `npm run dev` | API and shop together |
| backend | `npm test` | API tests against an in-memory MongoDB with a fake Razorpay (never reads `.env`) |
| backend | `npm start` / `npm run dev` | Run the API (dev restarts on changes) |
| backend | `npm run seed` · `npm run promote-admin` | Demo catalogue · make the first admin |
| frontend | `npm test` | Component tests (Vitest) in a simulated browser, with the API faked |
| frontend | `npm run build` · `npm run lint` | Production build (checks the CSP hash first) · ESLint |
| frontend | `npm run csp-hash` | Prints the hash of `index.html`'s inline script for `vercel.json` |

The first `npm test` downloads a MongoDB binary for the in-memory database (cached afterwards).

## Deploying

- **API (Render):** `render.yaml` builds `backend/` with `npm ci --omit=dev` and checks `GET /`.
  Set the secrets listed in it in the Render dashboard. In production the API refuses to start
  without a strong `JWT_SECRET` and an HTTPS `FRONTEND_URL`.
- **Shop (Vercel):** builds `frontend/`. Set `VITE_API_URL` to the API, e.g.
  `https://anm-shop-api.onrender.com/api`. `vercel.json` adds the security headers and proxies
  `/sitemap.xml` to the API.
- **Razorpay webhook:** in the Razorpay dashboard add `https://<api>/api/payment/webhook` for the
  `payment.captured` event, with the secret in `RAZORPAY_WEBHOOK_SECRET`.
- **Domains:** the shop and API addresses also appear in `frontend/index.html`,
  `frontend/public/robots.txt` and `frontend/vercel.json` (rewrite and Content-Security-Policy).
  Update them if either domain changes.
- **Content-Security-Policy:** if you edit the small inline script in `frontend/index.html`, run
  `npm run csp-hash` and put the new hash in `vercel.json` (the build fails until you do).

## Operating notes

- A refund that Razorpay refuses (or that a restart interrupts) emails the admins and appears
  under **Refund problems** on the Orders tab with a **Retry refund** button. Retrying first checks
  Razorpay, so a refund that already went through, or one made by hand in the Razorpay
  dashboard, is recorded instead of repeated. Checkout refunds that fail are logged as
  `AUTOMATIC REFUND FAILED` and need refunding in Razorpay.
- Rate-limit counts are kept in memory per API instance; use a shared store before running more
  than one instance.
