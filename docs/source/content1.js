const D = require('./diagrams');

const table = (head, rows, cls = '') => `<table class="${cls}"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const fig = (svg, caption) => `<figure>${svg}<figcaption>${caption}</figcaption></figure>`;
const chapter = (id, n, title, body) => `<section class="chapter" id="${id}"><div class="part-label">Part ${n}</div><h1 class="part">${title}</h1>${body}</section>`;

const ch1 = chapter('overview', 1, 'Project overview', `
<p class="lead">ANM-Shop is a full-stack online beauty store for customers in India. Shoppers browse skincare, makeup, haircare and body products, pay with Razorpay, track their orders, write reviews and get help through support tickets or an AI chat assistant. Admins manage products, orders, coupons, reviews, tickets and customers from one dashboard.</p>
<div class="cards">
  <div class="card"><div class="k">60</div><p>REST API endpoints across 12 route areas</p></div>
  <div class="card"><div class="k">10</div><p>MongoDB data models (plus a <code>migrations</code> marker collection)</p></div>
  <div class="card"><div class="k">20</div><p>frontend routes served by 19 page components</p></div>
  <div class="card"><div class="k">77</div><p>automated tests, run by GitHub Actions on every pull request: 54 for the API on an in-memory database, 23 for screens in a simulated browser</p></div>
  <div class="card"><div class="k">11</div><p>rate limiters protecting sign-in, email, payments, chat and more</p></div>
  <div class="card"><div class="k">7</div><p>default categories, managed by admins; 44 demo products in the seed data</p></div>
</div>
<h2>Who uses it</h2>
<div class="cards two">
  <div class="card"><h4>Shoppers</h4><p>Guests can browse, search and fill a cart. Signing up (with email verification) unlocks checkout, order history, bills, reviews, coupons, support tickets and the chat assistant.</p></div>
  <div class="card"><h4>Admins</h4><p>Accounts with <code>role: admin</code> see the admin dashboard: sales statistics in India time, products, categories, orders (with cancellations, returns and refunds), coupons, reviews, tickets, users and roles, and a search across orders, payments and customers. The first admin is made with the <code>promote-admin</code> script; after that admins manage roles in the dashboard.</p></div>
</div>
<h2>What it does</h2>
<div class="cards">
  <div class="card"><h4>Shopping</h4><p>Admin-managed categories, relevance-ranked search, up to 6 photos per product, Bad / Good / Excellent reviews, a per-account cart that refreshes prices and stock.</p></div>
  <div class="card"><h4>Accounts</h4><p>Sign-up with a 6-digit email code, sign-in, change password (signs out other devices), forgot / reset password by email link, self-service account deletion.</p></div>
  <div class="card"><h4>Checkout &amp; payment</h4><p>Server-side pricing in paise, ₹49 shipping under ₹499, one coupon per order, Razorpay Checkout, signature checks, webhook backup, automatic refunds.</p></div>
  <div class="card"><h4>Orders</h4><p>Order history with price breakdown, PDF bills and e-bill emails; customers cancel unshipped orders and admins mark returns, both refunded automatically.</p></div>
  <div class="card"><h4>Support</h4><p>Tickets with threaded replies and email notices; a Gemini-powered assistant that reads the customer's own orders, payments and tickets, finds products and adds them to the cart.</p></div>
  <div class="card"><h4>Launch-ready extras</h4><p>Privacy, terms and returns pages, SEO tags, sitemap, consent-gated analytics, a full Content-Security-Policy, dark mode, lazy pages (the footer no longer jumps while they load), resized images, spam protection, API and frontend tests run on every pull request, and business details and a grievance officer that appear once filled in.</p></div>
</div>
<h2>Where it runs</h2>
${table(['Part', 'Address', 'Hosting'], [
  ['Storefront (React app)', '<code>https://anm-shop.vercel.app</code>', 'Vercel (static build + CDN)'],
  ['API (Express)', '<code>https://anm-shop-api.onrender.com</code>', 'Render web service, free plan, Node 22'],
  ['Database', 'MongoDB Atlas', 'Managed replica set (needed for transactions)'],
  ['Source code', '<code>github.com/MOHILKUMAR/ANM-Shop</code>', '<code>main</code> branch, up to pull request #34'],
  ['Releases', 'GitHub tags', '<code>v0.9.0</code>: pre-launch (Razorpay still in test mode)'],
])}
<div class="note"><b>Scope of this document.</b> Everything here was taken from the code as of 10 October 2026, up to pull request #34 (CI, India time in emails, and business details on the site and the bills): <code>backend/</code>, <code>frontend/</code>, <code>render.yaml</code> and <code>frontend/vercel.json</code>. Secret values from <code>.env</code> files are not included; only the variable names are listed.</div>
`);

const ch2 = chapter('stack', 2, 'Technology stack', `
<h2>Frontend</h2>
${table(['Technology', 'Version', 'Used for'], [
  ['React + React DOM', '19.2.7', 'User interface, context providers, lazy pages'],
  ['React Router DOM', '7.18.4', 'Client-side routing (20 routes)'],
  ['Vite + @vitejs/plugin-react', '8.1.4 / 6.0.3', 'Dev server (proxies <code>/api</code> to port 5000) and production build'],
  ['Tailwind CSS (@tailwindcss/vite)', '4.3.2', 'Styling, plus custom brand colour variables and dark mode overrides'],
  ['jsPDF', '4.2.1', 'PDF bill generated in the browser (loaded only when used)'],
  ['write-excel-file', '4.1.1', 'Admin user list export to .xlsx (loaded only when used)'],
  ['@vercel/analytics, @vercel/speed-insights', '2.0.1 / 2.0.0', 'Cookie-free visit and speed data, only after consent'],
  ['ESLint (flat config)', '10.7.0', 'Linting with react-hooks and react-refresh rules'],
  ['Vitest · React Testing Library · jsdom', '5.0.3 · 16.3.3 · 29.0.2 (dev)', 'Component tests of the admin Orders, Tickets and Search tabs against a faked API (<code>npm test</code>)'],
])}
<p class="small">Production builds first check that the Content-Security-Policy in <code>vercel.json</code> matches the inline theme script (<code>scripts/csp-hash.mjs</code>).</p>
<h2>Backend</h2>
${table(['Technology', 'Version', 'Used for'], [
  ['Node.js', '22 (Render), 22.19 locally', 'Runtime (CommonJS modules)'],
  ['Express', '5.2.1', 'HTTP server and routing'],
  ['Mongoose', '9.7.3', 'MongoDB models, validation, transactions'],
  ['jsonwebtoken', '9.0.3', 'Session tokens (JWT, 30 days)'],
  ['bcryptjs', '3.0.3', 'Password hashing (cost 12)'],
  ['helmet / cors', '8.3.0 / 2.8.5', 'Security headers and origin allow-list'],
  ['express-rate-limit', '8.7.0', '11 rate limiters (in-memory store)'],
  ['multer', '2.4.0', 'Image upload in memory (5 MB, JPEG/PNG/WebP)'],
  ['cloudinary', '2.10.0', 'Product image storage (max 1600 × 1600)'],
  ['razorpay', '2.9.6', 'Orders, payment fetch / capture, refunds'],
  ['@google/genai', '2.24.0', 'Gemini chat assistant with function calling'],
  ['nodemailer', '10.0.14', 'Gmail SMTP fallback for email'],
  ['dotenv · nodemon', '17 · 3 (dev)', 'Environment loading, auto-restart in development'],
  ['node:test · supertest · mongodb-memory-server', 'Node 22 · 7.3 · 11.3 (dev)', 'API tests against an in-memory MongoDB replica set with a fake Razorpay'],
])}
<h2>External services</h2>
${table(['Service', 'Role in ANM-Shop'], [
  ['Vercel', 'Hosts the built React app; adds security headers; rewrites <code>/sitemap.xml</code> to the API and every other path to <code>index.html</code>; Web Analytics and Speed Insights.'],
  ['Render', 'Runs the Express API from <code>render.yaml</code> (free plan, health check on <code>/</code>).'],
  ['MongoDB Atlas', 'Stores all data. Payment fulfilment uses multi-document transactions, which need a replica set.'],
  ['Razorpay', 'Payment window in the browser (UPI, cards, net banking, wallets), Orders API, captures, refunds, <code>payment.captured</code> webhook.'],
  ['Cloudinary', 'Product photo upload (folder <code>anm-shop/products</code>) and resized delivery (<code>f_auto, q_auto, w_…</code>).'],
  ['Google Gemini', 'AI support assistant: model <code>gemini-3.8-flash</code>, fallback <code>gemini-3.5-flash</code>.'],
  ['Resend · Gmail', 'Transactional email (codes, reset links, e-bills, ticket updates). Resend when configured, Gmail SMTP otherwise.'],
  ['placehold.co', 'Placeholder images for the 44 seeded demo products.'],
])}
<h2>Folder structure</h2>
<div class="cards two">
<div class="card"><h4>backend/</h4><ul>
<li><code>app.js</code> middleware, routes, error handler; <code>index.js</code> start-up</li>
<li><code>config/</code> MongoDB connection, Cloudinary setup, business details for the e-bill</li>
<li><code>test/</code> API tests (<code>npm test</code>)</li>
<li><code>controller/</code> 12 controllers (auth, product, category, review, order, payment, coupon, ticket, chat, analytics, search, sitemap)</li>
<li><code>middleware/</code> protect, admin, rate limiters, spam guard</li>
<li><code>model/</code> 10 Mongoose schemas</li>
<li><code>routes/</code> one router per API area</li>
<li><code>utils/</code> pricing, categories, order refunds, Razorpay client, email, e-bill, AI assistant, tickets, reviews, migrations</li>
<li><code>data/</code> + <code>seed.js</code> demo catalogue; <code>promoteAdmin.js</code></li>
</ul></div>
<div class="card"><h4>frontend/</h4><ul>
<li><code>index.html</code> default SEO tags, preconnects, theme script</li>
<li><code>public/</code> icons, og-image.png, robots.txt, web manifest</li>
<li><code>src/App.jsx</code> router and layout; <code>src/index.jsx</code> providers</li>
<li><code>src/pages/</code> 19 pages, and tests for the Contact and policy pages and the PDF bill</li>
<li><code>src/components/</code> shared UI, product gallery and 7 admin tabs; <code>*.test.jsx</code> component tests</li>
<li><code>src/context/</code> AuthProvider, CartProvider</li>
<li><code>src/data/</code> contact info and business details, review maths, ticket labels</li>
<li>helpers: <code>api.js</code>, <code>useCategories.js</code>, <code>consent.js</code>, <code>imageUrl.js</code>, <code>money.js</code>, <code>usePageMeta.js</code></li>
<li><code>vercel.json</code>, <code>vite.config.js</code>, <code>eslint.config.js</code>, <code>scripts/csp-hash.mjs</code></li>
</ul></div>
</div>
<p class="small">The project root also holds <code>README.md</code>, <code>package.json</code> (runs both apps with <code>concurrently</code>), <code>render.yaml</code> (Render blueprint), <code>.github/workflows/ci.yml</code> (the CI checks) and <code>docs/</code> (this document and its sources).</p>
`);

const ch3 = chapter('hld', 3, 'High-level design (HLD)', `
<p class="lead">ANM-Shop is a classic three-tier web application: a single-page React app served from a CDN, one stateless REST API, and one MongoDB database, with payments, images, AI and email handled by managed services.</p>
<h2>3.1 System architecture</h2>
${fig(D.hld, 'Figure 3.1 — System architecture: who talks to whom')}
<ol class="steps">
<li><b>The browser loads the app from Vercel.</b> Vercel serves the static Vite build with year-long caching for hashed assets, security headers and an SPA fallback, so every page URL returns <code>index.html</code>.</li>
<li><b>The app calls the API directly</b> at <code>VITE_API_URL</code> with JSON requests. Signed-in requests carry <code>Authorization: Bearer &lt;JWT&gt;</code>. CORS only allows origins listed in <code>FRONTEND_URL</code>.</li>
<li><b>The API is the source of truth.</b> It re-prices every cart from the database, checks every payment with Razorpay and never trusts amounts from the browser.</li>
<li><b>Payments</b> open in the Razorpay window. The browser sends the result to <code>/api/payment/verify</code>. Razorpay also calls the API's webhook, so an order is still created if the browser disconnects.</li>
<li><b>Images</b> are uploaded by the API to Cloudinary and served to browsers from Cloudinary's CDN in the size each screen needs.</li>
<li><b>Email and AI</b> are outbound calls from the API: Resend or Gmail for email, Google Gemini for the chat assistant.</li>
</ol>
<h2>3.2 Deployment</h2>
${fig(D.deploy, 'Figure 3.2 — How code reaches production')}
<p>Every pull request first runs two GitHub Actions checks (<code>.github/workflows/ci.yml</code>, Node 22, no secrets): <b>API tests</b>, and the shop's <b>lint, tests and build</b> (the build also checks the Content-Security-Policy hash). Branch protection on <code>main</code> keeps the merge button disabled until both pass; an admin can bypass it only by ticking a box. Each merge runs the checks again on <code>main</code>. Releases are tagged on GitHub: <code>v0.9.0</code> marks the pre-launch code, and <code>v1.0.0</code> is planned for the day live payments start.</p>
<p>Both halves deploy from the same GitHub repository. Vercel builds <code>frontend/</code>; Render follows <code>render.yaml</code>: root <code>backend</code>, build <code>npm ci --omit=dev</code>, start <code>npm start</code>, health check <code>GET /</code>, <code>NODE_ENV=production</code>, <code>TRUST_PROXY=1</code> and a generated <code>JWT_SECRET</code>. Other secrets are entered once in the Render dashboard. On start the API connects to MongoDB, runs two safe fix-ups and then starts listening. In production it refuses to start if <code>JWT_SECRET</code> is weak or <code>FRONTEND_URL</code> is missing or not HTTPS.</p>
<h2>3.3 Key design decisions</h2>
<div class="cards two">
  <div class="card"><h4>Server-side pricing in paise</h4><p>Prices, shipping and coupons are computed only on the server, in whole paise, from database values. The same calculation runs for the quote and for the payment, so the amount shown is the amount charged.</p></div>
  <div class="card"><h4>Exactly-once orders</h4><p>Fulfilment runs in a MongoDB transaction that only proceeds while the payment record is <code>pending</code>; <code>Order.paymentId</code> is unique. Verify and the webhook can race safely.</p></div>
  <div class="card"><h4>Refund instead of overselling</h4><p>Stock and coupon limits are claimed atomically at fulfilment. If an item sold out or a coupon ran out while the customer was paying, the payment is refunded in full automatically. Cancelled and returned orders are refunded the same way, claimed atomically so they are never refunded twice.</p></div>
  <div class="card"><h4>Stateless sessions, revocable</h4><p>JWTs need no server session store. Changing or resetting a password sets <code>passwordChangedAt</code>, which invalidates every older token.</p></div>
  <div class="card"><h4>Cart in the browser</h4><p>Carts live in localStorage, one per account on a shared device, and are refreshed from <code>/api/products/lookup</code> on the cart and checkout pages.</p></div>
  <div class="card"><h4>Privacy by default</h4><p>Analytics load only after consent and strip query strings except <code>category</code> and <code>page</code>. Email codes and reset tokens are stored only as hashes.</p></div>
</div>
<h2>3.4 Quality attributes</h2>
${table(['Attribute', 'How it is achieved', 'Current limits'], [
  ['Security', 'helmet, full Content-Security-Policy, CORS allow-list, JWT + bcrypt, hashed codes and tokens, HMAC payment checks, spam guard, 11 rate limiters, input limits, HTML-escaped emails', 'Token kept in localStorage'],
  ['Reliability', 'webhook backup, transactions, automatic refunds with retry (admins emailed and a Refund problems list when one fails), idempotent start-up fix-ups, Gemini retries and fallback model, 54 API and 23 frontend tests run on every pull request', 'Failed checkout refunds need a manual refund in Razorpay'],
  ['Performance', 'CDN, lazy pages, on-demand jsPDF / Excel / Razorpay scripts, Cloudinary resizing, text-indexed search plus a partial-word scan, cached categories, immutable asset caching', 'Render free plan; the partial-word scan reads every product (fine for hundreds)'],
  ['Scalability', 'Stateless API (can add instances), indexed queries, paged admin lists', 'In-memory rate-limit counts are per instance; the admin user list loads every account'],
  ['Usability', 'Dark mode, skeleton loaders, clear error text, WCAG-AA colour tuning, mobile layouts, self-service cancel and account deletion', 'Returns are requested through a ticket'],
])}
`);

const ch4 = chapter('user', 4, 'User workflows', `
<p class="lead">How shoppers and admins move through the app. Each diagram shows what the person sees; Part 5 shows the matching API calls.</p>
<h2>4.1 Shopper journey</h2>
${fig(D.journey, 'Figure 4.1 — From landing page to a delivered order')}
<ol class="steps">
<li><b>Browse.</b> The home page shows a tile for each category (managed by admins). The Shop page has a search box (250 ms debounce; whole-word matches ranked by relevance first, then products containing the word inside a longer one, so “lip” also finds “Lipstick”), a category filter and pages of 24; the filter and page live in the URL. An old link to a renamed or removed category shows the whole shop with a note.</li>
<li><b>Choose.</b> A product page shows a photo gallery (up to 6), price, stock, an overall rating and reviews. “Add to cart” stores a copy of the product; quantity is capped at stock and 99.</li>
<li><b>Review the cart.</b> Opening the cart checks today's price and stock and lists changes, e.g. “now costs ₹X (was ₹Y)”, “Only N left”, “no longer sold”.</li>
<li><b>Sign in.</b> Checkout needs an account. A guest cart is merged into the account cart on sign-in.</li>
<li><b>Pay and track.</b> After payment the order appears in <i>My orders</i> with its status, breakdown, a downloadable PDF bill and the e-bill email. Until it ships, the customer can cancel it there for a full refund.</li>
</ol>
<h2>4.2 Sign-up and email verification</h2>
${fig(D.signup, 'Figure 4.2 — Creating and verifying an account')}
<ul>
<li>The form has a hidden <code>leaveBlank</code> field and sends how long it was open. Bots get the same reply as people, but nothing is saved.</li>
<li>Re-registering an <i>unverified</i> email replaces its name and password, so whoever controls the inbox ends up owning the account. Verifying requires the code <i>and</i> the password.</li>
<li>Sign-in is refused (403) until the email is verified; the app then sends the person to the verify page.</li>
</ul>
<h2>4.3 Sign in, sessions and password change</h2>
<ul>
<li>Sign-in returns a JWT valid for 30 days, kept in localStorage (<code>userInfo</code>). Expired tokens are dropped when the app loads.</li>
<li>Any 401 from the API fires a “session expired” event and signs the person out on that device.</li>
<li><b>Change password</b> (Account page) needs the current password; a wrong one returns 400 so the person is not logged out. Success signs out all other devices, emails a notice and returns a fresh token.</li>
<li><b>Delete account</b> (Account page) needs the password and a confirmation tick. In one step it removes the account, reviews and chat history, closes open tickets (kept as records, like orders and payments) and switches off coupons meant only for that customer. It is refused while an order is pending or shipped, while a refund to them is still pending or failed, while a payment is still being confirmed or a failed checkout is being refunded (checkouts touched in the last 24 hours), and for admins (another admin must make them a customer first). Admins deleting a customer get the same checks.</li>
</ul>
<h2>4.4 Forgot and reset password</h2>
${fig(D.reset, 'Figure 4.3 — Resetting a forgotten password')}
<p>The reply is the same whether or not the email has an account, so the form cannot be used to discover customers. Links are single-use, valid for 30 minutes, and at most one is sent per minute. Resetting also verifies the account.</p>
`);

const ch4b = `
<h2>4.5 Cart, checkout and payment</h2>
${fig(D.checkoutFlow, 'Figure 4.4 — The checkout page and its possible outcomes')}
${table(['Rule', 'Detail'], [
  ['Shipping', '₹49 when the items subtotal is below ₹499; free otherwise (both configurable on the server).'],
  ['Coupons', 'One per order. The customer’s usable coupons appear as one-tap suggestions (up to 4). An invalid coupon is reported and the price is shown without it.'],
  ['Address', 'Full name, street, city, PIN / postal code, country (default India), phone. Indian PINs must be 6 digits not starting with 0; phones need 8–15 digits.'],
  ['Payment methods', 'All Razorpay methods, unless the coupon limits them (e.g. UPI only); the window then shows only those.'],
  ['After paying', 'Success clears the cart and opens My orders. If confirmation fails because of the network, the app says the order will appear shortly and not to pay again.'],
])}
<h2>4.6 Orders, bills and reviews</h2>
<ul>
<li><b>My orders</b> lists each order with items, subtotal, shipping (or “Free”), discount with coupon code, total paid, delivery details and e-bill status.</li>
<li><b>Download bill (PDF)</b> builds an A4 receipt in the browser: header, order and payment IDs, address, item table and totals (<code>ANM-Shop-Bill-&lt;id&gt;.pdf</code>); for a cancelled or returned order it adds a “Refunded” (or “Refund in progress”) line with the amount. Once the business details are filled in, a “Sold by” block names the seller (legal name, address, GSTIN, phone). The totals, any refund line and the closing line always stay together above the bottom margin.</li>
<li><b>Resend e-bill</b> emails the receipt again (paid orders that were not cancelled or returned, 5 per hour). The e-bill shows the order time in India time, and the seller once the business details are filled in.</li>
<li><b>Cancel order:</b> shown while an order is pending. The full amount, shipping included, is refunded to the original payment method; stock goes back and the coupon use is returned. The order then shows its refund (“issued” or “in progress”). Shipped orders are returned through a support ticket; the admin marks the return and the refund follows.</li>
<li><b>Reviews:</b> one per customer per product, rated Bad, Good or Excellent with a 10–1000 character comment. Submitting again edits it. A “Verified buyer” label appears if the customer ordered the product (and goes once every order of it is cancelled). Public names look like “Priya S.”.</li>
</ul>
<h2>4.7 Support: tickets and the chat assistant</h2>
${fig(D.support, 'Figure 4.5 — Getting help')}
<ul>
<li>Tickets need a subject (3–150 chars), one of 8 categories and a description (10–4000 chars); an order can be linked. A duplicate within 10 minutes returns the existing ticket; at most 10 can be open at once.</li>
<li>An admin reply moves <code>open</code> to <code>in_progress</code>; a customer reply reopens a <code>resolved</code> ticket; closed tickets cannot be replied to.</li>
<li>The assistant can list orders, payments and tickets, look up one order, search products, add items to the cart (with a “Go to checkout” button) and open a ticket. It cannot cancel, refund or change addresses. Conversations hold 30 turns; “New chat” starts again.</li>
</ul>
<h2>4.8 Admin workflow</h2>
${fig(D.admin, 'Figure 4.6 — The admin dashboard and its tabs')}
${table(['Tab', 'What an admin can do'], [
  ['Overview', 'Customers, orders, products, paid revenue, paid orders, this month, average order value; last 7 days and 6 months of revenue by India calendar day / month; order status split; low stock (≤ 5); top 5 products.'],
  ['Products', 'Add or edit name, description, price, stock, category and up to 6 photos (5 MB each; keep, remove or make one the main photo); delete (also deletes its reviews). 50 per page.'],
  ['Categories', 'Add, rename, describe, reorder and delete categories. Renaming updates its products and coupons; a category still in use cannot be deleted.'],
  ['Orders', '20 per page with status filters and counts. Set pending → shipped → delivered; cancel an unshipped order or mark a shipped / delivered one returned (choosing whether to restock) — both refund through Razorpay and email the customer. When a cancel or return refund fails, every admin is emailed; a <b>Refund problems</b> filter lists failed refunds and ones interrupted for 10 minutes, each with Retry (which first checks Razorpay, so a refund already made — even by hand in the Razorpay dashboard — is recorded, not repeated). Delete an order record (not while its refund is unfinished).'],
  ['Coupons', 'Create / edit every rule (type, value, dates, limits, eligible products from a searchable picker, categories, customers, payment methods, visibility); pause or resume; delete.'],
  ['Reviews', 'Filter by visible / hidden and rating; hide or show. Hidden reviews stay with the author but drop out of the page and the rating.'],
  ['Tickets', 'Filter by status with counts, 50 per page, reply, change status; the customer is emailed each time. After a change the page reloads and refills; a reply that moves the open ticket to the top is followed to page 1 with its thread still open.'],
  ['Users', 'Table with orders, total spent (refunds excluded) and join date; filter; “Download Excel” (.xlsx); make verified users admins or admins customers (not yourself, never the last admin); the person sees the new role after signing in again.'],
  ['Search', 'Find orders, payment records and customers by ID, short code (#XXXXXXXX), <code>pay_…</code>, <code>order_…</code> or email; a paid checkout Razorpay is still confirming shows “Paid, being confirmed”; delete records and customer accounts where safe.'],
])}
`;

const ch5 = chapter('api-flows', 5, 'API workflows', `
<p class="lead">Sequence diagrams for the main requests. Solid arrows are calls, dashed arrows are replies, numbers give the order. All paths are relative to <code>https://anm-shop-api.onrender.com</code>.</p>
<h2>5.1 Sign-up and email verification</h2>
${fig(D.seqSignup, 'Figure 5.1 — POST /api/auth/register and /verify-email')}
<h2>5.2 Sign-in and authenticated requests</h2>
${fig(D.seqLogin, 'Figure 5.2 — POST /api/auth/login, then any protected route')}
<h2>5.3 Password reset</h2>
${fig(D.seqReset, 'Figure 5.3 — POST /api/auth/forgot-password and /reset-password')}
<h2>5.4 Checkout and payment</h2>
${fig(D.seqPay, 'Figure 5.4 — Quote, create the payment, pay in Razorpay, verify and fulfil')}
<h2>5.5 Razorpay webhook (backup path)</h2>
${fig(D.seqWebhook, 'Figure 5.5 — POST /api/payment/webhook creates the order if the browser never called /verify')}
<p>Configure the webhook in the Razorpay dashboard: URL <code>https://&lt;api&gt;/api/payment/webhook</code>, event <code>payment.captured</code>, secret = <code>RAZORPAY_WEBHOOK_SECRET</code>. The route is registered before the JSON parser so the signature is checked against the exact raw body.</p>
<h2>5.6 Cancel or return an order</h2>
${fig(D.seqCancel, 'Figure 5.6 — POST /api/orders/:id/cancel, /return and /refund')}
<h2>5.7 AI chat assistant</h2>
${fig(D.seqChat, 'Figure 5.7 — POST /api/chat/messages and the tool loop')}
`);

const ch6 = chapter('lld', 6, 'Low-level design (LLD)', `
<h2>6.1 Backend request pipeline</h2>
${fig(D.pipeline, 'Figure 6.1 — What every API request passes through (gold steps are added per route)')}
<ol>
<li><code>x-powered-by</code> off; <code>trust proxy</code> = <code>TRUST_PROXY</code> (1 on Render) so per-IP limits see the real client.</li>
<li><code>helmet()</code>, then CORS: no Origin, an origin in <code>FRONTEND_URL</code>, or (outside production) localhost on any port.</li>
<li><code>POST /api/payment/webhook</code> with a raw body (1 MB) — before any JSON parsing.</li>
<li><code>express.json</code> (100 kb), <code>express.urlencoded</code> (20 kb, 50 fields), then <code>req.body ??= {}</code> because Express 5 leaves it undefined.</li>
<li>Routers. Per route: rate limiter → <code>spamGuard</code> → <code>protect</code> → <code>admin</code> → multer (images) → controller.</li>
<li>Error handler: upload errors → 400, CORS → 403, everything else → a generic message without internal details.</li>
</ol>
<h2>6.2 Backend modules</h2>
${table(['Module', 'Responsibility'], [
  ['<code>controller/authController.js</code>', 'Register, verify, resend code, login, change / forgot / reset password, delete own account, list and delete users (shared deletion checks, one transaction), change roles'],
  ['<code>app.js</code> · <code>index.js</code>', 'The Express app (middleware, routes, error handler) · start-up: database, default categories, fix-ups, listen'],
  ['<code>controller/ProductController.js</code>', 'Catalogue with search (text-index matches ranked first, then partial-word matches), admin list and search, cart look-up, create / update with up to 6 photos, delete'],
  ['<code>controller/categoryController.js</code>', 'Public category list; admin list with usage counts; create, rename (with products and coupons) and delete'],
  ['<code>controller/reviewController.js</code>', 'Product reviews, own review, admin moderation'],
  ['<code>controller/paymentController.js</code>', 'Quote, create payment, verify, webhook, fulfilment transaction, refunds, payment-record cleanup'],
  ['<code>controller/orderController.js</code>', 'My orders, paged admin list, status, cancel, return, retry refund, delete, resend e-bill'],
  ['<code>controller/couponController.js</code>', 'Coupon CRUD, pause / resume, “My coupons”'],
  ['<code>controller/ticketController.js</code>', 'Create, list, reply, change status'],
  ['<code>controller/chatController.js</code>', 'Conversation lock, turn limit, calling the assistant, reset'],
  ['<code>controller/AnalyticsController.js</code>', 'Dashboard statistics in Asia/Kolkata time'],
  ['<code>controller/searchController.js</code>', 'Admin search by IDs, short codes, Razorpay IDs, email'],
  ['<code>controller/sitemapController.js</code>', 'XML sitemap of pages, categories and up to 45,000 products'],
  ['<code>utils/pricing.js</code>', 'Cart lines, coupon status and eligibility, discount maths, quote'],
  ['<code>utils/categories.js</code>', 'Cached category list, default categories on first start'],
  ['<code>utils/orderRefunds.js</code> · <code>razorpayClient.js</code>', 'Cancel / return transaction, Razorpay refund, admin alert, retry (checking Razorpay first), customer email · shared Razorpay client'],
  ['<code>utils/supportAssistant.js</code>', 'Gemini calls, retries, fallback model, 7 tools, system prompt'],
  ['<code>utils/sendEmail.js</code> · <code>sendOrderInvoice.js</code>', 'Resend or Gmail delivery; HTML + text e-bill (India time; the seller from <code>config/business.js</code>)'],
  ['<code>utils/tickets.js</code> · <code>orderLookup.js</code> · <code>reviews.js</code>', 'Shared ticket creation, #short codes, rating recount and legacy review migration'],
  ['<code>utils/orderMigrations.js</code>', 'One-time order breakdown fix, recorded in <code>migrations</code>'],
])}
<h2>6.3 Frontend architecture</h2>
${fig(D.frontend, 'Figure 6.2 — Component tree and shared helpers')}
<ul>
<li><b>AuthProvider</b> holds <code>{user, login, logout}</code>, persists the user in localStorage and listens for the session-expired event.</li>
<li><b>CartProvider</b> holds <code>{cart, itemCount, addToCart, updateQuantity, removeFromCart, clearCart, refreshCart}</code>. Carts are stored per account (<code>shopnestCart:&lt;userId&gt;</code>, <code>shopnestCart:guest</code>); the guest cart merges on sign-in.</li>
<li><b>api.js</b> wraps <code>fetch</code>: base URL from <code>VITE_API_URL</code> (default <code>/api</code>), errors carry <code>status</code> and <code>data</code>, a network failure becomes status 0.</li>
<li><b>usePageMeta</b> sets the title, description, canonical URL, Open Graph and Twitter tags per page, and <code>noindex</code> on private pages.</li>
<li><b>useCategories</b> is a small shared store (<code>useSyncExternalStore</code>): the categories load once for every page; the admin Categories tab, or an old category link, refreshes them, and only the newest answer is used.</li>
<li><b>Page loading:</b> the footer sits inside the same <code>Suspense</code> boundary as the pages and loading placeholders fill the screen, so the footer no longer jumps down while a page arrives.</li>
<li><b>Tests:</b> <code>npm test</code> in <code>frontend/</code> renders the admin Orders, Tickets and Search tabs in jsdom against a fake API that follows the server's rules, the Contact and policy pages with sample business details, and the PDF bill with jsPDF faked.</li>
<li><b>Business details:</b> <code>src/data/contactInfo.js</code> holds the legal name, address, phone and GSTIN, and the grievance officer. They ship empty; each part appears on the Contact page, footer, Terms, Privacy policy and PDF bill only once it is filled in.</li>
</ul>
`);

const ch6b = `
<h2>6.4 Data model</h2>
${fig(D.er, 'Figure 6.3 — Collections, key fields and relationships (PK primary key, FK reference, UQ unique)')}
<ul>
<li>A <b>User</b> has many Orders, PaymentIntents, Reviews, Tickets and CouponUsages, and at most one ChatConversation.</li>
<li>A <b>PaymentIntent</b> is one checkout attempt. It snapshots items, address and amounts, and links to the <b>Order</b> it created. A <code>pending</code> one with a <code>paymentId</code> was paid and is waiting for Razorpay to confirm it.</li>
<li><b>Product.numReviews</b> and <b>ratingCounts</b> are denormalised from visible Reviews and recounted on every change.</li>
<li><b>CouponUsage</b> counts uses per customer per coupon (unique pair) for <code>perUserLimit</code>.</li>
<li><b>Category</b> names are stored on products and in coupon restrictions, so a rename updates both in one transaction. Products in a category that no longer exists are hidden from the shop and cannot be bought.</li>
</ul>
<h2>6.5 Pricing engine</h2>
${fig(D.pricing, 'Figure 6.4 — utils/pricing.js: from cart to quote')}
${table(['Coupon type', 'Discount', 'Notes'], [
  ['percentage', '1–100 % of the eligible subtotal (rounded down)', 'Optional <code>maxDiscount</code> cap'],
  ['fixed', '₹1 – ₹10,000,000, at most the eligible subtotal', '<code>maxDiscount</code> not used'],
  ['free_shipping', 'Waives the ₹49 fee', 'Fails with “This order already ships free” when shipping is already free'],
  ['buy_x_get_y', 'Units sorted by price (highest first); in each full group of X+Y, the Y cheapest are free', 'X and Y 1–20 each; optional cap'],
])}
<p>Eligible lines are those matching <code>applicableProducts</code> or <code>applicableCategories</code> (none set = all). <code>minCartValue</code> is checked against the whole subtotal. The discount is clamped so the total stays at least ₹1, Razorpay's minimum.</p>
<h2>6.6 State machines</h2>
${fig(D.states, 'Figure 6.5 — Status lifecycles for payment records, orders and tickets')}
${table(['Coupon status', 'When'], [
  ['disabled', '<code>isActive</code> is false (paused)'],
  ['scheduled', '<code>startsAt</code> is in the future'],
  ['expired', '<code>expiresAt</code> has passed'],
  ['used_up', '<code>usedCount</code> has reached <code>usageLimit</code>'],
  ['active', 'none of the above'],
])}
<h2>6.7 Payment fulfilment internals</h2>
<ol class="steps">
<li><b>Create:</b> validate the address, re-price, create a Razorpay order (amount in paise, INR, random receipt) and a <code>PaymentIntent</code> holding items, address, <code>amountPaise</code>, <code>subtotalPaise</code>, <code>discountPaise</code> (every saving including waived shipping), coupon and allowed methods.</li>
<li><b>Verify:</b> find the intent for this user; check the HMAC-SHA256 signature of <code>order_id|payment_id</code> with a timing-safe compare; fetch the payment and check order, amount and currency; capture if only authorised (still authorised → the payment ID is noted on the record and 202 “pending”; the webhook finishes it).</li>
<li><b>Fulfil (transaction):</b> refuse if the account has been deleted meanwhile (the payment is refunded instead); redeem the coupon (method allowed, <code>usedCount</code> &lt; limit, per-user count &lt; limit); for each item <code>stock −= qty</code> only where <code>stock ≥ qty</code>; create the Order with shipping = (amount − subtotal + discount) / 100; mark the intent <code>completed</code>.</li>
<li><b>Refuse → refund:</b> any failed step aborts the transaction. The intent is claimed atomically (<code>pending → refund_pending</code>), a full refund is requested, and the status becomes <code>refunded</code> or <code>refund_failed</code> (logged as AUTOMATIC REFUND FAILED for a manual refund).</li>
<li><b>Notify:</b> on success the e-bill is emailed and <code>invoiceEmailSent</code> is recorded.</li>
</ol>
<h2>6.8 Cancellations and returns</h2>
<ul>
<li>A cancel (customer: own pending order; admin: any pending order) or return (admin: shipped or delivered) runs one transaction: a <code>findOneAndUpdate</code> that only matches while the status still allows it sets the new status and <code>refund: {status: pending, amount}</code>, puts stock back (always for cancels, by choice for returns) and, for cancels, gives back the coupon use to the exact coupon named on the checkout record.</li>
<li>The full amount is then refunded through Razorpay (the reason goes in a note, cut to 250 characters, within Razorpay's 256-character limit); the order records <code>refunded</code> with the refund ID, or <code>failed</code> with Razorpay's error. When that first attempt fails, every admin is emailed in the background. Once the order is closed, a failing email (to the admins or the customer) or a failure to record the refund's result no longer makes the request fail.</li>
<li>Retry works on failed refunds and on ones still pending after 10 minutes. It first lists the payment's refunds at Razorpay: one noted with this order, or refunds that together cover the amount (e.g. made by hand in the dashboard), is recorded instead of refunding again.</li>
<li>Statuses <code>cancelled</code> and <code>returned</code> are final: the manual status change only applies while an order is pending, shipped or delivered, in the same atomic step. Revenue figures leave them out, the customer's “verified buyer” label goes once every order of that product is cancelled, and an order with an unfinished refund cannot be deleted.</li>
</ul>
<h2>6.9 AI assistant internals</h2>
${table(['Tool', 'What it returns or does'], [
  ['<code>list_my_orders</code>', 'The customer\'s last 10 orders'],
  ['<code>get_order(order_code)</code>', 'One order with its payment record'],
  ['<code>list_my_payments</code>', 'Last 10 payment records with readable status (including “paid but being confirmed”)'],
  ['<code>search_products(query?, category?)</code>', 'Up to 8 products with review counts'],
  ['<code>add_to_cart(product_id, quantity 1–10)</code>', 'An action the browser applies (capped at stock), plus a checkout button'],
  ['<code>create_support_ticket(…)</code>', 'Opens a ticket with <code>source: assistant</code>'],
  ['<code>list_my_tickets</code>', 'Tickets with the latest team reply'],
])}
<p>Limits: 1000 characters per message, 30 turns per chat, 6 tool rounds per message, one message at a time (5-minute lock), 60-second model timeout, 2 tries per model on 5xx before the fallback. Quota errors return “usage limit”, a bad key switches the widget to offline mode, and without <code>GEMINI_API_KEY</code> the widget points customers to tickets.</p>
`;

module.exports = { table, chapter, ch1, ch2, ch3, ch4, ch4b, ch5, ch6, ch6b };
