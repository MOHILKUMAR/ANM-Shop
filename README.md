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
| `docs/` | Project documentation (PDF); its sources and build steps are in `docs/source/` |
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

GitHub Actions (`.github/workflows/ci.yml`) runs the API tests, and the shop's lint, tests and
build, on every pull request and on each push to `main`. It uses no secrets.

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

- A refund that Razorpay refuses emails the admins and appears under **Refund problems** on the
  Orders tab with a **Retry refund** button (if the database also fails to record the refusal,
  it shows as "in progress" and appears there after 10 minutes); one interrupted by a restart
  appears there after 10 minutes (without an email). Retrying first checks Razorpay, so a refund that already went
  through, or one made by hand in the Razorpay dashboard, is recorded instead of repeated.
  Checkout refunds that fail are logged as `AUTOMATIC REFUND FAILED` and need refunding in
  Razorpay.
- Rate-limit counts are kept in memory per API instance; use a shared store before running more
  than one instance.

## Known limitations

Small issues found in code reviews and left on purpose, because they are rare or harmless at
the shop's current size. Each says when it matters and what to do meanwhile.

**Refunds and payments**
- **A refund that went through but couldn't be saved doesn't alert the admins.** If Razorpay
  accepts a refund and the database write right after it fails, the admins aren't emailed,
  although the customer is told "We've been alerted" (and gets the usual "refund being
  arranged" email). After 10 minutes the order appears under **Refund problems**; **Retry
  refund** then finds the refund at Razorpay and records it (no second refund).
- **Account deletion and a payment can cross in the same instant.** If a customer deletes their
  account at the exact moment Razorpay confirms a payment, an order can still be created for
  the deleted account. On the Orders tab it shows as "Customer" with no email (the Search tab
  says "Deleted account"). Cancel it from the Orders tab to refund it. No email can reach the
  customer, so use the phone number in the order's delivery address (search for the order on
  the Search tab) if they need telling. A payment confirmed even slightly later is refunded
  automatically.
- **The "interrupted refund" check uses the admin's computer clock.** If that clock is several
  minutes off, an interrupted refund can show "in progress" without a Retry button (clock
  behind) or offer Retry a little early, which answers "no failed refund to retry" (clock
  ahead). Keep the computer's clock set automatically, or wait a few minutes and reload.

**Accounts and coupons**
- **Deleting an account resets per-customer coupon limits.** Limits like "once per customer"
  are counted per account, so someone who deletes their account and signs up again with the
  same email can use the coupon again. A coupon's total usage limit still applies; give
  valuable coupons a total limit or restrict them to named customers.

**Admin dashboard**
- **Keyboard focus resets after a reply moves a ticket.** When a reply moves the ticket to page
  1 of the Tickets tab, the list follows it with its thread open, but keyboard focus goes back
  to the top of the page.
- **Unused product photos stay in Cloudinary.** Photos removed from a product, the photos of
  deleted products, and uploads from a product save that failed are never deleted from
  Cloudinary. This only uses storage. Don't delete files from the `anm-shop/products` folder by
  hand: it also holds every photo the shop still shows, and nothing marks which ones are
  unused. Deleting a photo that a product still uses breaks it on the shop pages.
- **"Paid, being confirmed" doesn't expire on the Search tab.** A checkout that was paid but
  never confirmed (for example a payment Razorpay later voided) keeps that label. Before
  deleting such a record, check the payment in the Razorpay dashboard: if Razorpay captures it
  after the record is gone, the shop ignores it, so no order is created and it has to be
  refunded by hand. If the dashboard already shows it as captured but the shop has no order for
  it (Razorpay couldn't reach the shop), refund it by hand there too.

**Shop pages**
- **Search reads every product.** Partial-word matching ("lip" finding "Lipstick") checks every
  product's name and description on each search. That is instant for a few hundred products;
  with tens of thousands, search-as-you-type would slow down and needs a search service (for
  example MongoDB Atlas Search).
- **Product lists can repeat or skip a product.** Products created in the same millisecond (for
  example in one bulk import) have no fixed order, so paging through the shop, a category,
  search results or the admin product list can show one twice and miss another.
- **A stale category error on the home page.** If reloading the category list fails after it
  has loaded once (a network blip), the home page can show "Categories could not be loaded"
  above the working category tiles until the page is reloaded.
- **Some PDF bills lose their last line.** When the list of items ends near the bottom of a page
  (for example a bill with 15 or 16 items, a discount and a refund), the closing "Thank you"
  line can fall off the page and the refund line can land in the printer's margin. Most bills
  print fine, and the items and totals are never affected.

Larger features that aren't built yet (partial refunds, emails when an order ships, the paid
Gemini tier, a shared rate-limit store, httpOnly cookie sessions) are covered in the project
documentation PDF, in the "Known limitations and next steps" chapter.
