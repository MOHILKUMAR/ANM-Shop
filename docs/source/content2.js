const { table, chapter } = require('./content1');

const m = (method) => `<span class="method ${method}">${method}</span>`;
const tag = (t) => {
  const cls = t === 'admin' ? 'admin' : t === 'signed in' ? 'auth' : t === 'public' ? 'public' : 'limit';
  return `<span class="tag ${cls}">${t}</span>`;
};
const api = (rows) => table(['', 'Path', 'Access', 'Purpose'], rows.map(([meth, p, access, purpose]) => [m(meth), `<code>${p}</code>`, access.split(',').map((a) => tag(a.trim())).join(''), purpose]), 'api');

const ch7 = chapter('api', 7, 'API reference', `
<p class="lead">60 endpoints. <span class="tag public">public</span> needs nothing, <span class="tag auth">signed in</span> needs a Bearer JWT, <span class="tag admin">admin</span> also needs <code>role: admin</code>; gold tags are rate limiters (Part 10).</p>
<h2>Root</h2>
${api([
  ['GET', '/', 'public', 'Health check <code>{service, status: "ok"}</code> (used by Render)'],
  ['GET', '/sitemap.xml', 'public', 'XML sitemap; Vercel proxies the storefront\'s /sitemap.xml here'],
  ['POST', '/api/payment/webhook', 'public', 'Razorpay <code>payment.captured</code> webhook; raw body, HMAC-checked'],
])}
<h2>/api/auth</h2>
${api([
  ['POST', '/api/auth/register', 'public, authLimiter, signupLimiter, spamGuard', 'Create an account (or replace an unverified one) and email a 6-digit code'],
  ['POST', '/api/auth/verify-email', 'public, otpLimiter', 'Email + code + password → verified; returns user and JWT'],
  ['POST', '/api/auth/resend-verification', 'public, otpLimiter, spamGuard', 'New code (generic reply, 60 s gap)'],
  ['POST', '/api/auth/login', 'public, authLimiter', 'Sign in; 403 <code>verificationRequired</code> if unverified'],
  ['PUT', '/api/auth/password', 'signed in, authLimiter', 'Change password; signs out other sessions; new token'],
  ['POST', '/api/auth/forgot-password', 'public, otpLimiter, spamGuard', 'Email a single-use reset link (30 min); generic reply'],
  ['POST', '/api/auth/reset-password', 'public, otpLimiter', 'New password from the token; verifies; returns user and JWT'],
  ['GET', '/api/auth/users', 'admin', 'All accounts with orders, total spent, last order, joined'],
  ['DELETE', '/api/auth/users/:id', 'admin', 'Delete a non-admin account, its chat and reviews (orders, payments and tickets kept); same checks as deleting your own'],
  ['PUT', '/api/auth/users/:id/role', 'admin', '<code>{role: user | admin}</code> for another verified account; never your own, never the last admin'],
  ['DELETE', '/api/auth/me', 'signed in, authLimiter', 'Delete your own account (password required; not while an order is on its way, a refund is owed or a payment is being confirmed; not admins)'],
])}
<h2>/api/products</h2>
${api([
  ['GET', '/api/products', 'public', 'Catalogue: <code>page</code>, <code>limit</code> (24, max 100), <code>search</code> (whole words by relevance, then partial words), <code>category</code> (unknown → 400 <code>unknownCategory</code>)'],
  ['POST', '/api/products', 'admin', 'Create (multipart <code>images</code>: 1–6 photos, 5 MB each, JPEG/PNG/WebP)'],
  ['GET', '/api/products/manage', 'admin', 'Admin list (all categories, paginated, optional <code>search</code>)'],
  ['GET', '/api/products/lookup', 'public, lookupLimiter', '<code>?ids=a,b,c</code> (≤ 50): current price and stock for cart refresh'],
  ['GET', '/api/products/:id/reviews', 'public', 'Visible reviews (10 per page, max 50) + summary'],
  ['POST', '/api/products/:id/reviews', 'signed in, reviewLimiter', 'Create or edit your review'],
  ['GET', '/api/products/:id/reviews/mine', 'signed in', 'Your review, including whether it is hidden'],
  ['DELETE', '/api/products/:id/reviews/mine', 'signed in, reviewLimiter', 'Delete your review'],
  ['GET', '/api/products/:id', 'public', 'One product (404 if its category is no longer one of the shop\'s)'],
  ['PUT', '/api/products/:id', 'admin', 'Partial update; <code>keepImages</code> (JSON list) + new <code>images</code>, up to 6 in total'],
  ['DELETE', '/api/products/:id', 'admin', 'Delete the product and its reviews'],
])}
<h2>/api/payment</h2>
${api([
  ['POST', '/api/payment/quote', 'signed in, quoteLimiter', 'Server price: subtotal, shipping, discount, savings, total, couponError'],
  ['POST', '/api/payment/order', 'signed in, paymentLimiter', 'Validate address, re-price, create Razorpay order + PaymentIntent'],
  ['POST', '/api/payment/verify', 'signed in, paymentLimiter', 'Check signature and payment, capture, fulfil, send e-bill'],
  ['DELETE', '/api/payment/records/:id', 'admin', 'Delete a payment record (not recent pending or refund_pending)'],
])}
<h2>/api/orders</h2>
${api([
  ['GET', '/api/orders', 'admin', 'All orders, 20 per page, optional <code>status</code> or <code>refund=problem</code>, with per-status counts and <code>refundProblems</code>'],
  ['GET', '/api/orders/myorders', 'signed in', 'Your orders'],
  ['POST', '/api/orders/:id/resend-invoice', 'signed in, invoiceEmailLimiter', 'Email the e-bill again (your paid order; not cancelled or returned)'],
  ['PUT', '/api/orders/:id/status', 'admin', 'Set pending, shipped or delivered (only while it is one of those)'],
  ['POST', '/api/orders/:id/cancel', 'signed in', 'Cancel a pending order (customers: their own; admins: any) — full refund, stock back, coupon use back'],
  ['POST', '/api/orders/:id/return', 'admin', 'Mark a shipped / delivered order returned <code>{restock, reason}</code> — full refund'],
  ['POST', '/api/orders/:id/refund', 'admin', 'Retry a failed (or stuck) order refund; records a refund Razorpay already made instead of repeating it'],
  ['DELETE', '/api/orders/:id', 'admin', 'Delete the order record only (no refund, no stock restore); refused while its refund is pending or failed'],
])}
<h2>/api/coupons</h2>
${api([
  ['GET', '/api/coupons/mine', 'signed in', 'Coupons this customer can use, with uses left'],
  ['GET', '/api/coupons', 'admin', 'All coupons with status and summary'],
  ['POST', '/api/coupons', 'admin', 'Create a coupon'],
  ['PUT', '/api/coupons/:id', 'admin', 'Replace its settings (usedCount untouched)'],
  ['PATCH', '/api/coupons/:id/active', 'admin', 'Pause or resume <code>{isActive}</code>'],
  ['DELETE', '/api/coupons/:id', 'admin', 'Delete the coupon and its usage counts'],
])}
<h2>/api/reviews (moderation)</h2>
${api([
  ['GET', '/api/reviews', 'admin', 'All reviews; filter by status and rating; counts'],
  ['PATCH', '/api/reviews/:id', 'admin', 'Hide or show <code>{hidden}</code>; recounts the rating'],
])}
<h2>/api/tickets</h2>
${api([
  ['POST', '/api/tickets', 'signed in, ticketLimiter', 'Open a ticket'],
  ['GET', '/api/tickets/mine', 'signed in', 'Your tickets (up to 50)'],
  ['POST', '/api/tickets/:id/messages', 'signed in, ticketReplyLimiter', 'Reply (own ticket, or any ticket as admin; admin replies email the customer and return the order\'s details)'],
  ['GET', '/api/tickets', 'admin', 'All tickets, 50 per page (<code>?status=</code>, <code>?page=</code>), with counts'],
  ['PUT', '/api/tickets/:id/status', 'admin', 'Change status and email the customer'],
])}
<h2>/api/categories</h2>
${api([
  ['GET', '/api/categories', 'public', 'Categories in display order (name, description, icon)'],
  ['GET', '/api/categories/manage', 'admin', 'Every category with how many products and coupons use it'],
  ['POST', '/api/categories', 'admin', 'Add a category (name 2–60, unique ignoring case)'],
  ['PUT', '/api/categories/:id', 'admin', 'Edit; a rename also renames it on products and coupons'],
  ['DELETE', '/api/categories/:id', 'admin', 'Delete an unused category (409 while products or coupons use it)'],
])}
<h2>/api/chat · /api/analytics · /api/admin/search</h2>
${api([
  ['GET', '/api/chat', 'signed in', 'Transcript, configured flag, turns left'],
  ['POST', '/api/chat/messages', 'signed in, chatLimiter', 'Send a message to the assistant; returns reply and actions'],
  ['DELETE', '/api/chat', 'signed in', 'Start a new chat'],
  ['GET', '/api/analytics', 'admin', 'Dashboard statistics (India time)'],
  ['GET', '/api/admin/search', 'admin', '<code>?q=</code> order / payment / user ID, #code, pay_…, order_…, or email'],
])}
`);

const field = (rows) => table(['Field', 'Type and rules'], rows);
const ch8 = chapter('models', 8, 'Data model reference', `
<div class="cards two">
<div class="card"><h4>User</h4>${field([
  ['name', 'String, required'], ['email', 'String, required, unique'], ['password', 'bcrypt hash, required'], ['role', '<code>user</code> | <code>admin</code>'], ['verified', 'Boolean, default false'],
  ['verificationOtp*', 'hash, expiry, sent-at, attempts — hidden'], ['passwordReset*', 'token hash, expiry, sent-at — hidden'], ['passwordChangedAt', 'Date (revokes older tokens)'],
])}<p class="small">No timestamps; “joined” comes from the ObjectId.</p></div>
<div class="card"><h4>Product</h4>${field([
  ['name', '≤ 120 chars'], ['description', '≤ 5000 chars'], ['price', '0.01 – 100,000,000'], ['category', 'a Category name (checked in controllers)'], ['stock', 'integer 0 – 1,000,000'],
  ['imageUrls', 'main photo URL'], ['images[]', 'up to 6 photo URLs'], ['numReviews · ratingCounts', 'visible reviews only'], ['createdAt', 'Date, default now'], ['text index', 'name (×5) + description'],
])}</div>
<div class="card"><h4>Order</h4>${field([
  ['user', '→ User'], ['items[]', 'productId → Product, qty ≥ 1, price'], ['totalAmount', '₹ paid'], ['subtotalAmount · shippingFee · discountAmount', '₹ breakdown'],
  ['couponCode · paymentMethod', 'String'], ['address', 'fullName, street, city, postalCode, country, phone'], ['paymentId', 'unique, sparse'], ['invoiceEmailSent', 'Boolean'],
  ['status', 'pending | shipped | delivered | cancelled | returned'], ['closedAt · closedBy · restocked', 'when / who cancelled or returned it'], ['refund', 'status, amount, Razorpay refund ID, reason, error'], ['timestamps', 'createdAt, updatedAt'],
])}</div>
<div class="card"><h4>PaymentIntent</h4>${field([
  ['user', '→ User'], ['items[] · address', 'snapshot at checkout'], ['razorpayOrderId', 'unique'], ['amountPaise', 'amount charged'], ['subtotalPaise · discountPaise', 'paise; discount = all savings'],
  ['coupon', '{id → Coupon, code}'], ['allowedPaymentMethods', 'String[]'], ['paymentId · order', 'Razorpay ID (set once paid) · → Order'],
  ['status', 'pending | completed | refund_pending | refunded | refund_failed'], ['refundId · failureReason', 'String'],
])}</div>
<div class="card"><h4>Coupon</h4>${field([
  ['code', 'unique, uppercase, ≤ 30'], ['description', '≤ 200'], ['discountType', 'percentage | fixed | free_shipping | buy_x_get_y'], ['discountValue · buyQuantity · getQuantity', 'Numbers'],
  ['minCartValue · maxDiscount', '₹'], ['startsAt · expiresAt', 'Dates'], ['usageLimit · perUserLimit · usedCount', 'limits'], ['applicableProducts / Categories / Users', 'empty = no restriction'],
  ['paymentMethods', 'upi | card | netbanking | wallet'], ['isActive · showToCustomers', 'Boolean'],
])}</div>
<div class="card"><h4>Review</h4>${field([
  ['product · user', '→ Product, → User; unique pair'], ['name', 'public name, ≤ 60'], ['rating', 'bad | good | excellent'], ['comment', '≤ 1000 (10+ required in the API)'],
  ['verifiedBuyer', 'Boolean'], ['hidden · hiddenAt', 'moderation'], ['indexes', '(product, hidden, createdAt), (createdAt)'],
])}</div>
<div class="card"><h4>Ticket</h4>${field([
  ['user · order', '→ User, → Order (optional)'], ['subject · description', '≤ 150 · ≤ 4000'], ['category', 'order, payment, refund, delivery, return, product, account, other'],
  ['status', 'open | in_progress | resolved | closed'], ['source', 'customer | assistant'], ['messages[]', 'author, authorName, body ≤ 4000, createdAt'], ['lastActivityAt', 'Date, indexed'],
])}</div>
<div class="card"><h4>Category</h4>${field([
  ['name', 'unique, 2–60'], ['description', '≤ 200'], ['icon', '1–2 characters'], ['sortOrder', '0–999, display order'], ['timestamps', 'createdAt, updatedAt'],
])}<p class="small">The 7 launch categories are added on first start.</p></div>
<div class="card"><h4>ChatConversation · CouponUsage</h4>${field([
  ['ChatConversation.user', '→ User, unique'], ['apiMessages', 'exact Gemini history (JSON)'], ['transcript[]', 'role, text, actions, at'], ['turns · busyUntil', 'turn count · lock'],
  ['CouponUsage.coupon · user', '→ Coupon, → User; unique pair'], ['CouponUsage.count', 'uses so far'],
])}</div>
</div>
`);

const ch9 = chapter('security', 9, 'Security', `
${table(['Area', 'Measures'], [
  ['Transport &amp; headers', 'HTTPS only (production refuses non-HTTPS origins). API: helmet defaults. Storefront: <code>X-Content-Type-Options: nosniff</code>, <code>Referrer-Policy: strict-origin-when-cross-origin</code>, <code>X-Frame-Options: DENY</code>, a full Content-Security-Policy (<code>default-src \'self\'</code>; scripts only from the shop, Razorpay and Vercel analytics, the inline theme script by SHA-256 hash; images from Cloudinary and placehold.co; API and Razorpay connections; <code>frame-ancestors \'none\'</code>), Permissions-Policy blocking camera, microphone and location.'],
  ['CORS', 'Only origins listed in <code>FRONTEND_URL</code> (plus localhost outside production); others get 403.'],
  ['Start-up checks', 'Production refuses to start with a <code>JWT_SECRET</code> under 32 characters or a placeholder, or without valid HTTPS <code>FRONTEND_URL</code> origins.'],
  ['Passwords', 'bcrypt cost 12; 8–72 bytes; never returned (<code>select: false</code>).'],
  ['Sessions', 'JWT <code>{id}</code>, 30 days; tokens issued before <code>passwordChangedAt</code> are rejected; deleted users rejected.'],
  ['Email codes', '6 digits from <code>crypto.randomInt</code>, stored as HMAC-SHA256, 10 minutes, 60 s resend gap, 5 wrong tries, timing-safe compare, password also required.'],
  ['Reset links', '32 random bytes, only the SHA-256 hash stored, 30 minutes, single use (atomic), generic replies, token removed from the URL and from analytics.'],
  ['Bots', 'Hidden <code>leaveBlank</code> field on sign-up, forgot-password and resend; sign-up also rejects forms sent in under 2 s; bots get a fake success.'],
  ['Payments', 'Prices from the database only; HMAC-SHA256 checks for checkout and webhook signatures; payment fetched and matched (order, amount, INR); transactional, idempotent fulfilment; atomic refund claim.'],
  ['Input', 'ObjectId checks, regex-escaped search, length limits, address / PIN / phone rules, coupon dates must include a time zone, body size limits, image type and size limits, HTML-escaped emails, Excel cells written as plain values.'],
  ['AI assistant', 'Only the signed-in customer\'s records; tool results treated as data; validated tool inputs; one message at a time; no refunds, cancellations or address changes.'],
  ['Accounts &amp; roles', 'Deleting your own account needs the password (a wrong one returns 400, not 401) and waits while money or an order is still in flight; a payment that arrives after deletion is refunded, not turned into an order; coupons meant only for that customer are switched off so they cannot become open to everyone. Role changes: admins only, never their own, only verified accounts become admins, and the last admin cannot be removed.'],
  ['Refunds', 'Cancels and returns claim the order atomically in a transaction, so an order is never refunded twice; Razorpay is called once per claim, and a retry first checks Razorpay for a refund already made. A manual status change cannot reopen a cancelled or returned order.'],
  ['Admin safety', 'Admins cannot delete admin accounts or themselves, or delete a customer with money or an order in flight; recent pending and in-refund payment records, and orders with an unfinished refund, cannot be deleted.'],
])}
<div class="note"><b>Privacy.</b> Analytics are cookie-free and load only after consent (<code>anmShopConsent</code>). The policy covers India's DPDP Act 2023, names every processor (Razorpay, MongoDB Atlas, Render, Vercel, Cloudinary, Resend / Gmail, Gemini) and discloses that the free Gemini tier may use chat content.</div>
`);

const ch10 = chapter('limits', 10, 'Rate limits', `
<p class="lead">All limiters use express-rate-limit with standard <code>RateLimit</code> headers and a JSON message. Counts are kept in memory, so they reset when the API restarts and are not shared between instances.</p>
${table(['Limiter', 'Limit', 'Window', 'Key', 'Applied to'], [
  ['authLimiter', '20', '15 min', 'IP', 'register, login, change password, delete own account'],
  ['otpLimiter', '8', '15 min', 'IP', 'verify-email, resend, forgot-password, reset-password'],
  ['signupLimiter', '30', '60 min', 'IP', 'register — counts successes and 409 “already exists”; form errors and 5xx do not count'],
  ['paymentLimiter', '12', '15 min', 'IP', 'create payment, verify'],
  ['quoteLimiter', '120', '15 min', 'user', 'price quote'],
  ['lookupLimiter', '1500', '15 min', 'IP', 'cart look-up (high because mobile networks share IPs)'],
  ['invoiceEmailLimiter', '5', '60 min', 'user', 'resend e-bill'],
  ['chatLimiter', '30', '15 min', 'user', 'chat messages'],
  ['ticketLimiter', '5', '60 min', 'user', 'new tickets'],
  ['ticketReplyLimiter', '30', '15 min', 'user', 'ticket replies'],
  ['reviewLimiter', '20', '60 min', 'user', 'save / delete review'],
])}
`);

const ch11 = chapter('frontend', 11, 'Frontend reference', `
${table(['Path', 'Page', 'Purpose'], [
  ['<code>/</code>', 'Home', 'Hero, a tile per category, feature cards'],
  ['<code>/shop</code>', 'Shop', 'Grid, search, category filter, pages of 24; an old category link shows the whole shop'],
  ['<code>/product/:id</code>', 'ProductDetail', 'Photo gallery, details, add to cart, reviews'],
  ['<code>/cart</code>', 'Cart (lazy)', 'Quantities, refreshed prices, free-shipping hint'],
  ['<code>/checkout</code>', 'Checkout (lazy)', 'Address, live quote, coupons, Razorpay'],
  ['<code>/login</code> · <code>/register</code>', 'AuthPage (lazy)', 'Sign in / sign up (honeypot, timing)'],
  ['<code>/verify-email</code>', 'VerifyEmail (lazy)', 'Code + password, resend'],
  ['<code>/forgot-password</code> · <code>/reset-password</code>', 'ForgotPassword · ResetPassword (lazy)', 'Request link · set new password'],
  ['<code>/orders</code>', 'OrderHistory (lazy)', 'Orders, refunds, cancel, PDF bill, resend e-bill'],
  ['<code>/account</code>', 'Account (lazy)', 'Profile, My coupons, change password, delete account'],
  ['<code>/support</code>', 'Support (lazy)', 'Tickets, replies, open chat'],
  ['<code>/admin</code>', 'AdminDashboard (lazy)', 'Stats and 8 tabs; “Access denied” for non-admins'],
  ['<code>/about</code> · <code>/contact</code>', 'About · Contact (lazy)', 'Brand story · support email, LinkedIn, business details once filled in'],
  ['<code>/privacy</code> · <code>/terms</code> · <code>/returns</code>', 'Policy pages (lazy)', 'Updated 4 Oct (Terms), 10 Oct 2026 (Privacy, Returns)'],
  ['<code>*</code>', 'NotFound (lazy)', '404 page, noindex'],
])}
<div class="cards two">
<div class="card"><h4>SEO</h4><ul>
<li><code>usePageMeta</code> sets title (“… | ANM-Shop”), description (≤ 160), canonical, OG and Twitter tags.</li>
<li>Private pages get <code>noindex</code>; <code>robots.txt</code> blocks them and links the sitemap.</li>
<li><code>index.html</code> holds defaults for link previews (en-IN, 1200 × 630 og-image).</li>
</ul></div>
<div class="card"><h4>Performance</h4><ul>
<li>16 lazy pages; jsPDF, Excel export and Razorpay loaded on demand; chat mounts on first open.</li>
<li>The footer no longer jumps while a page loads: it appears with the page, and placeholders fill the screen.</li>
<li>First 4 product cards load eagerly; others lazily.</li>
<li>Cloudinary sizes: 300 (card), 560 (detail), 96 (cart), 64 (admin) × 2 for sharp screens.</li>
<li>Preconnect to the API; hashed assets cached for a year.</li>
</ul></div>
<div class="card"><h4>Consent and analytics</h4><ul>
<li>Banner: “Accept” or “Essential only”; reopened from “Privacy choices”.</li>
<li>Vercel Analytics and Speed Insights imported only after consent; nothing sent after withdrawal.</li>
</ul></div>
<div class="card"><h4>Look and feel</h4><ul>
<li>Brand palette (plum <code>#754656</code>, gold accents), serif headings.</li>
<li>Dark mode saved in <code>anmShopTheme</code>, applied before first paint.</li>
<li>Skeleton loaders for lists, grids, stats and tables.</li>
</ul></div>
</div>
`);

const ch12 = chapter('ops', 12, 'Configuration and operations', `
<h2>12.1 Environment variables</h2>
${table(['Variable', 'Where', 'Purpose'], [
  ['<code>MONGO_URL</code>', 'backend', 'MongoDB connection string (required)'],
  ['<code>JWT_SECRET</code>', 'backend', 'Signs JWTs and email-code HMACs; ≥ 32 chars in production'],
  ['<code>FRONTEND_URL</code>', 'backend', 'Allowed origins, comma-separated; the first is the storefront URL in emails and the sitemap'],
  ['<code>NODE_ENV</code> · <code>PORT</code> · <code>TRUST_PROXY</code>', 'backend', 'production checks · port (5000) · proxy hops (1)'],
  ['<code>RAZORPAY_KEY_ID</code> · <code>RAZORPAY_KEY_SECRET</code>', 'backend', 'Payments (checkout returns 503 without them)'],
  ['<code>RAZORPAY_WEBHOOK_SECRET</code>', 'backend', 'Webhook signature'],
  ['<code>CLOUDINARY_CLOUD_NAME</code> · <code>_API_KEY</code> · <code>_API_SECRET</code>', 'backend', 'Image uploads'],
  ['<code>RESEND_API_KEY</code> · <code>RESEND_FROM_EMAIL</code>', 'backend', 'Email through Resend (both needed)'],
  ['<code>EMAIL_USER</code> · <code>EMAIL_PASS</code>', 'backend', 'Gmail SMTP fallback (local development)'],
  ['<code>GEMINI_API_KEY</code> · <code>GEMINI_MODEL</code> · <code>GEMINI_FALLBACK_MODEL</code>', 'backend', 'Chat assistant and optional model overrides'],
  ['<code>SHIPPING_FEE</code> · <code>FREE_SHIPPING_ABOVE</code>', 'backend', 'Rupees; defaults 49 and 499'],
  ['<code>ADMIN_EMAIL</code>', 'backend', 'First admin, made by <code>npm run promote-admin</code>; later admins are set in the Users tab'],
  ['<code>VITE_API_URL</code>', 'frontend', 'API base, e.g. <code>https://anm-shop-api.onrender.com/api</code> (must be set on Vercel)'],
])}
<p class="small">The project README repeats the setup and deployment steps.</p>
<h2>12.2 Running locally</h2>
<ol class="steps">
<li>From the project root: <code>npm run install:all</code> (installs the root tools, backend and frontend).</li>
<li>Copy <code>backend/.env.example</code> to <code>backend/.env</code> and fill in at least <code>MONGO_URL</code> and <code>JWT_SECRET</code>; add Razorpay test keys, Cloudinary, email and Gemini keys for those features.</li>
<li>Optional demo data: <code>cd backend && npm run seed</code> (44 products; running it again only adds missing ones and never overwrites dashboard changes; <code>node seed.js -d</code> removes them).</li>
<li><code>npm run dev</code> starts the API on port 5000 and Vite on 5173; Vite proxies <code>/api</code> to the API.</li>
<li><code>cd backend &amp;&amp; npm test</code> runs the 54 API tests on an in-memory MongoDB with a fake Razorpay; it never reads <code>.env</code> (the first run downloads the MongoDB binary). <code>cd frontend &amp;&amp; npm test</code> runs the 23 component tests in jsdom with the API faked. GitHub Actions runs both on every pull request.</li>
<li>Sign up, then set <code>ADMIN_EMAIL</code> and run <code>npm run promote-admin</code> in <code>backend/</code> to get an admin account.</li>
</ol>
<h2>12.3 Scripts</h2>
${table(['Where', 'Script', 'Does'], [
  ['root', '<code>install:all</code> · <code>dev</code> · <code>dev:server</code> · <code>dev:client</code> · <code>build</code>', 'install root tools, backend and frontend · run both · API only · web only · build the web app'],
  ['backend', '<code>start</code> · <code>dev</code> · <code>test</code> · <code>seed</code> · <code>promote-admin</code>', 'node · nodemon · API tests · demo catalogue · first admin'],
  ['frontend', '<code>dev</code> · <code>build</code> · <code>preview</code> · <code>lint</code> · <code>test</code> · <code>csp-hash</code>', 'Vite dev · CSP check + production build · preview · ESLint · component tests (Vitest) · print the theme-script hash'],
])}
<h2>12.4 Start-up sequence</h2>
<ol>
<li><code>connectDB()</code> — exits if MongoDB is unreachable or <code>MONGO_URL</code> is missing.</li>
<li><code>ensureDefaultCategories()</code> — adds the 7 launch categories when the collection is empty.</li>
<li><code>migrateEmbeddedReviews()</code> — moves old 1–5 star reviews into the Review collection (nothing to do once moved).</li>
<li><code>fixOrderBreakdowns()</code> — one-time repair of free-shipping coupon orders, recorded as <code>order-shipping-breakdown-2026-10</code> in <code>migrations</code>.</li>
<li><code>app.listen(PORT)</code>. Fix-up errors are logged and never stop the shop from starting.</li>
</ol>
<h2>12.5 Operating checklist</h2>
<ul>
<li>Razorpay webhook configured to <code>/api/payment/webhook</code> for <code>payment.captured</code>.</li>
<li>Check the Orders tab's <b>Refund problems</b> filter (admins are also emailed when a cancel or return refund fails) and use Retry refund. Watch Render logs for “AUTOMATIC REFUND FAILED” (checkout refunds: refund in the Razorpay dashboard).</li>
<li>After editing the inline script in <code>index.html</code>, run <code>npm run csp-hash</code> and update <code>vercel.json</code>; the build stops until they match.</li>
<li>Keep <code>FRONTEND_URL</code> (Render) and <code>VITE_API_URL</code> (Vercel) in step if either domain changes; the domains also appear in <code>index.html</code>, <code>robots.txt</code> and <code>vercel.json</code> (rewrite and CSP).</li>
<li>GitHub Actions runs the tests, lint and build on every pull request, and <code>main</code> requires both checks. Before a release, also try a checkout with Razorpay test keys, and have each branch reviewed before it is merged.</li>
<li>Before taking real orders, fill in the business details and grievance officer in <code>frontend/src/data/contactInfo.js</code>, and the same business values in <code>backend/config/business.js</code> for the e-bill. A test fails while the two differ or if a value has a character the PDF bill's font can't print (₹, №, Hindi). Update the “Last updated” dates on the Terms and Privacy pages.</li>
<li>Don't delete files from Cloudinary's <code>anm-shop/products</code> folder by hand: it holds every live product photo as well as unused ones.</li>
</ul>
`);

const ch13 = chapter('history', 13, 'Project history', `
<p class="lead">Developed between 26 September and 10 October 2026 by Mohil Kumar (GitHub: MOHILKUMAR).</p>
${table(['PR', 'Date', 'Change'], [
  ['—', '26 Sep', 'Initial commit of the store (73 files)'],
  ['#1–#3', '26 Sep', 'Payment reliability (webhook, auto-refunds, trust proxy); sign-up takeover, double-charge and e-bill spam fixes; Vercel + Render deploy config'],
  ['#4–#8', '26 Sep', 'Admin dashboard crash fix; admin search; change password; admin deletes and forgot password; skeleton loading, Users tab and Excel export'],
  ['#9–#10', '26 Sep', 'Support tickets and AI assistant (Gemini free tier); retries and fallback model'],
  ['#11', '27 Sep', 'Coupons: admin management, My coupons, checkout pricing; shipping and discount in orders and bills'],
  ['#12', '28 Sep', 'Separate cart per account on a shared device'],
  ['#13', '1 Oct', 'Product reviews (Bad / Good / Excellent) with admin hiding'],
  ['#15', '4–9 Oct', 'Launch checklist: policies, SEO, consent and analytics, speed, spam protection, review fixes'],
  ['#16', '9 Oct', 'Shared <code>formatInr</code> helper for every rupee amount'],
  ['#17–#19', '9 Oct', 'Rate-limit follow-ups, run-once order breakdown fix-up, removal of an unused stored shipping fee'],
  ['#20', '9 Oct', 'This project documentation'],
  ['#21', '10 Oct', 'Fix known limitations: categories in the database, ranked search, photo galleries, paged admin lists, cancel and return with refunds, account deletion, role management, full CSP, API tests, README, dependency fixes (second edition of this document)'],
  ['#22–#23', '10 Oct', 'Skip the test MongoDB download on install; the footer no longer jumps while pages load'],
  ['#24', '10 Oct', 'Code-review fixes: partial-word search, old category links, safer refunds (atomic status change, Razorpay note limit, exact coupon, Refund problems, admin alerts, retry checks Razorpay), account deletion gaps'],
  ['#25', '10 Oct', 'Admin Tickets tab reloads and follows a ticket after a reply; first frontend tests (Vitest)'],
  ['#26', '10 Oct', 'Background refund alerts, a 24-hour window and admin checks for account deletion, “paid but being confirmed”, Orders tab loading fix'],
  ['#27–#28', '10 Oct', 'Known limitations in the README, and small fixes from its review'],
  ['#29–#30', '10 Oct', 'Third edition of this document, and its sources in <code>docs/source/</code>'],
  ['#31', '10 Oct', 'CI: GitHub Actions runs the API tests and the shop’s lint, tests and build on every pull request; branch protection then made both checks required on <code>main</code>'],
  ['#32', '10 Oct', 'E-bill and password-changed emails show India time (the server runs in UTC); tagged <code>v0.9.0</code>, the pre-launch release'],
  ['#33', '10 Oct', 'Business details and a grievance officer on the Contact page, footer, Terms and Privacy policy, shown once filled in'],
  ['#34', '10 Oct', 'The seller on the PDF bill and the e-bill email; long PDF bills keep their closing lines on the page'],
  ['next', '10 Oct', 'This fourth edition of the documentation'],
], 'history')}
`);

const ch14 = chapter('limitations', 14, 'Known limitations and next steps', `
<p class="lead">Fixed since the first edition: hard-coded categories, regex-only search, single product photos, unpaged admin lists, no cancel or return, admin-only account deletion, script-only admins, partial CSP, no tests, template README, unused packages. Since the second edition: the footer jumping while pages load, search missing partial words, dead links to renamed categories, refund and account-deletion gaps found in code reviews, and no frontend tests. Since the third edition: no CI, emails showing the server’s UTC time, no business details or grievance officer, and long PDF bills losing their last line.</p>
${table(['Area', 'Limitation', 'Suggested next step'], [
  ['Orders', 'Refunds are always the full amount; returns are requested through a ticket; no email when an order ships or is delivered; deleting an order record does not refund.', 'Partial refunds per item, an in-app return request, shipping emails.'],
  ['Checkout refunds', 'If an automatic refund for a checkout (item sold out while paying) fails, it must be refunded in the Razorpay dashboard.', 'Show those payment records with a retry button, as orders have.'],
  ['Rate limits', 'In-memory counts reset on restart and are per instance.', 'Use a shared store (e.g. Redis) before running more than one instance.'],
  ['Sessions', 'JWT kept in localStorage for 30 days. httpOnly cookies would be third-party while the API is on another domain.', 'Serve the API under the shop’s domain, then move to httpOnly cookies.'],
  ['Cart', 'Browser-only; not synced across devices.', 'Optional server-side cart for signed-in users.'],
  ['Admin scale', 'The Users tab loads every account at once.', 'Page and search the user list on the server.'],
  ['SEO', 'Tags are set in the browser, so link previews show the defaults; domains are hard-coded (also in the CSP).', 'Pre-render product pages; move domains to config.'],
  ['AI assistant', 'Free Gemini tier: quota / busy errors, and content may be used by Google.', 'Paid tier for production traffic.'],
  ['Launch', 'Razorpay is still in test mode, and the business details and grievance officer ship empty (nothing shows until they are filled in, in the site’s file and the API’s).', 'Fill in the details, switch Razorpay to live mode, place and refund one real order, then tag <code>v1.0.0</code>.'],
  ['Testing', '54 API tests and 23 frontend component tests (admin Orders, Tickets and Search tabs, Contact and policy pages, PDF bill), run by GitHub Actions on every pull request; checkout, account and other screens are checked by hand.', 'Cover checkout and account screens.'],
  ['Small known issues', 'The README’s “Known limitations” section lists the small issues left on purpose (rare, or harmless at the shop’s size), each with a workaround: e.g. an unsaved refund not alerting admins, coupon limits reset by re-registering, unused photos left in Cloudinary.', 'Fix them as the shop grows; the README says when each starts to matter.'],
  ['Tooling', 'nodemon (development only) has an advisory whose suggested fix is a 2017 downgrade.', 'Replace it with <code>node --watch</code>.'],
])}
<p class="small" style="margin-top:6mm">Fourth edition, updated on 10 October 2026 from the ANM-Shop repository up to pull request #34.</p>
`);

module.exports = { ch7, ch8, ch9, ch10, ch11, ch12, ch13, ch14 };
