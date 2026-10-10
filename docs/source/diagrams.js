const fs = require('fs');
const path = require('path');
const { C, sequence, flow, entity, svgOpen, textBlock } = require('./lib');

const D = {};

// ===================== HLD =====================
D.hld = fs.readFileSync(path.join(__dirname, 'hld.svg'), 'utf8');

D.deploy = flow({
  width: 1000, height: 350,
  nodes: [
    { id: 'dev', kind: 'start', x: 105, y: 60, w: 190, t: 'Developer\nmerges a pull request' },
    { id: 'gh', x: 355, y: 60, w: 240, t: 'GitHub repository\nMOHILKUMAR/ANM-Shop · main' },
    { id: 'vb', kind: 'ext', x: 640, y: 60, w: 250, t: 'Vercel build (frontend/)\nvite build → static files' },
    { id: 'cdn', kind: 'end', x: 885, y: 60, w: 210, t: 'Vercel CDN\nanm-shop.vercel.app' },
    { id: 'rb', kind: 'ext', x: 640, y: 195, w: 250, t: 'Render build (backend/)\nnpm ci --omit=dev · Node 22' },
    { id: 'st', x: 885, y: 195, w: 210, t: 'npm start\nconnect DB → fix-ups → listen' },
    { id: 'hc', kind: 'end', x: 885, y: 305, w: 210, t: 'Health check GET /\nanm-shop-api.onrender.com' },
  ],
  edges: [
    { from: 'dev', to: 'gh', fp: 'r', tp: 'l' },
    { from: 'gh', to: 'vb', fp: 'r', tp: 'l' },
    { from: 'vb', to: 'cdn', fp: 'r', tp: 'l' },
    { from: 'gh', to: 'rb', fp: 'b', tp: 'l', label: 'render.yaml blueprint', l: [400, 160] },
    { from: 'rb', to: 'st', fp: 'r', tp: 'l' },
    { from: 'st', to: 'hc', fp: 'b', tp: 't' },
  ],
});

// ===================== User workflows =====================
D.journey = flow({
  width: 1000, height: 495,
  nodes: [
    { id: 'n1', kind: 'start', x: 120, y: 60, w: 200, t: 'Home page\ncategories · highlights' },
    { id: 'n2', x: 370, y: 60, w: 210, t: 'Shop\nsearch · category · pages' },
    { id: 'n3', x: 620, y: 60, w: 200, t: 'Product page\ndetails · reviews' },
    { id: 'n4', x: 870, y: 60, w: 210, t: 'Cart\nprices & stock refreshed' },
    { id: 'd1', kind: 'decision', x: 870, y: 188, w: 190, h: 76, t: 'Signed in?' },
    { id: 'n5', x: 600, y: 188, w: 230, t: 'Sign in, or sign up\n+ verify the email code' },
    { id: 'n6', x: 870, y: 318, w: 220, t: 'Checkout\naddress · coupon · live price' },
    { id: 'n7', kind: 'ext', x: 612, y: 318, w: 220, t: 'Razorpay window\nUPI · card · net banking' },
    { id: 'd2', kind: 'decision', x: 355, y: 318, w: 200, h: 80, t: 'Payment\nconfirmed?' },
    { id: 'n9', kind: 'bad', x: 112, y: 318, w: 196, h: 66, t: 'Not completed:\nnothing charged, or\nautomatic refund' },
    { id: 'n8', kind: 'end', x: 355, y: 445, w: 240, t: 'Order placed\nstock reserved · e-bill emailed' },
    { id: 'n10', x: 612, y: 445, w: 220, t: 'My orders\nstatus · PDF bill · e-bill' },
    { id: 'n11', x: 870, y: 445, w: 220, t: 'Review the product,\nor get help (chat / ticket)' },
  ],
  edges: [
    { from: 'n1', to: 'n2', fp: 'r', tp: 'l' },
    { from: 'n2', to: 'n3', fp: 'r', tp: 'l' },
    { from: 'n3', to: 'n4', fp: 'r', tp: 'l' },
    { from: 'n4', to: 'd1', fp: 'b', tp: 't' },
    { from: 'd1', to: 'n5', fp: 'l', tp: 'r', label: 'no' },
    { from: 'n5', to: 'n6', fp: 'b', tp: 't', tdx: -45, via: [[600, 252], [825, 252]], label: 'signed in', l: [712, 252] },
    { from: 'd1', to: 'n6', fp: 'b', tp: 't', label: 'yes' },
    { from: 'n6', to: 'n7', fp: 'l', tp: 'r', label: 'Pay' },
    { from: 'n7', to: 'd2', fp: 'l', tp: 'r' },
    { from: 'd2', to: 'n9', fp: 'l', tp: 'r', label: 'no' },
    { from: 'd2', to: 'n8', fp: 'b', tp: 't', label: 'yes' },
    { from: 'n8', to: 'n10', fp: 'r', tp: 'l' },
    { from: 'n10', to: 'n11', fp: 'r', tp: 'l' },
  ],
});

D.signup = flow({
  width: 1000, height: 690,
  nodes: [
    { id: 's', kind: 'start', x: 320, y: 40, w: 240, h: 46, t: 'Open “Create account”' },
    { id: 'e', x: 320, y: 120, w: 270, h: 50, t: 'Enter name, email, password' },
    { id: 'd1', kind: 'decision', x: 320, y: 220, w: 290, h: 98, t: 'Looks like a bot?\n(hidden field filled, or\nsent in under 2 seconds)' },
    { id: 'b1', kind: 'bad', x: 765, y: 220, w: 300, h: 60, t: 'Same “check your email” reply;\nnothing saved, no email sent' },
    { id: 'd2', kind: 'decision', x: 320, y: 345, w: 250, h: 82, t: 'Email already\nverified?' },
    { id: 'b2', kind: 'bad', x: 765, y: 345, w: 300, h: 60, t: '409 “account already exists”\n→ sign in or reset password' },
    { id: 'c', x: 320, y: 460, w: 320, h: 60, t: 'Account saved (unverified)\n6-digit code emailed, valid 10 minutes' },
    { id: 'v', x: 320, y: 560, w: 300, h: 58, t: 'Verify page:\nemail + code + password' },
    { id: 'd3', kind: 'decision', x: 765, y: 560, w: 220, h: 80, t: 'Code\ncorrect?' },
    { id: 'r', kind: 'info', x: 765, y: 460, w: 300, h: 60, t: 'Try again (5 wrong tries max)\nor resend (1 per 60 seconds)' },
    { id: 'ok', kind: 'end', x: 765, y: 655, w: 300, h: 54, t: 'Verified and signed in\n(session valid 30 days)' },
  ],
  edges: [
    { from: 's', to: 'e' },
    { from: 'e', to: 'd1' },
    { from: 'd1', to: 'b1', fp: 'r', tp: 'l', label: 'yes' },
    { from: 'd1', to: 'd2', label: 'no' },
    { from: 'd2', to: 'b2', fp: 'r', tp: 'l', label: 'yes' },
    { from: 'd2', to: 'c', label: 'no' },
    { from: 'c', to: 'v' },
    { from: 'v', to: 'd3', fp: 'r', tp: 'l' },
    { from: 'd3', to: 'ok', label: 'yes' },
    { from: 'd3', to: 'r', fp: 't', tp: 'b', label: 'no' },
    { from: 'r', to: 'v', fp: 'l', tp: 'r', tdy: -16, via: [[545, 460], [545, 544]] },
  ],
});

D.reset = flow({
  width: 1000, height: 345,
  nodes: [
    { id: 's', kind: 'start', x: 105, y: 55, w: 180, t: '“Forgot password?”' },
    { id: 'e', x: 345, y: 55, w: 220, t: 'Enter email\n(hidden bot field)' },
    { id: 'g', x: 600, y: 55, w: 240, t: 'Same reply for any email;\nlink sent only if it exists' },
    { id: 'm', kind: 'ext', x: 865, y: 55, w: 230, t: 'Email with reset link\nsingle use · 30 minutes' },
    { id: 'p', x: 865, y: 190, w: 240, t: 'Reset page: new password ×2\n(token hidden from the URL)' },
    { id: 'd', kind: 'decision', x: 590, y: 190, w: 220, h: 82, t: 'Link valid\nand unused?' },
    { id: 'ok', kind: 'end', x: 255, y: 190, w: 300, h: 70, t: 'Password changed, account verified,\nother devices signed out,\nsigned in here' },
    { id: 'no', kind: 'bad', x: 590, y: 300, w: 270, t: '“Link invalid or expired”\n→ request a new one' },
  ],
  edges: [
    { from: 's', to: 'e', fp: 'r', tp: 'l' },
    { from: 'e', to: 'g', fp: 'r', tp: 'l' },
    { from: 'g', to: 'm', fp: 'r', tp: 'l' },
    { from: 'm', to: 'p' },
    { from: 'p', to: 'd', fp: 'l', tp: 'r' },
    { from: 'd', to: 'ok', fp: 'l', tp: 'r', label: 'yes' },
    { from: 'd', to: 'no', label: 'no' },
  ],
});

D.checkoutFlow = flow({
  width: 1000, height: 660,
  nodes: [
    { id: 's', kind: 'start', x: 300, y: 36, w: 270, h: 44, t: 'Open Checkout (signed in)' },
    { id: 'r', x: 300, y: 112, w: 300, t: 'Cart refreshed: current prices,\nstock, sold-out items removed' },
    { id: 'q', x: 300, y: 194, w: 300, t: 'Server quote: subtotal, shipping,\ndiscount, total' },
    { id: 'c', kind: 'info', x: 760, y: 194, w: 290, t: 'Apply a coupon, or tap one\nof “My coupons” (up to 4)' },
    { id: 'a', x: 300, y: 276, w: 300, t: 'Address: 6-digit PIN for India,\nphone with 8–15 digits' },
    { id: 'p', x: 300, y: 358, w: 300, t: '“Pay ₹X securely”\n(enabled once the quote is ready)' },
    { id: 'z', kind: 'ext', x: 300, y: 440, w: 300, t: 'Razorpay window\n(a coupon may limit the methods)' },
    { id: 'd', kind: 'decision', x: 300, y: 530, w: 190, h: 64, t: 'Outcome' },
    { id: 'o1', kind: 'end', x: 112, y: 622, w: 210, h: 62, t: 'Paid → order placed,\ne-bill, My orders' },
    { id: 'o2', kind: 'info', x: 345, y: 622, w: 220, h: 62, t: 'Window closed →\nnothing charged' },
    { id: 'o3', kind: 'info', x: 588, y: 622, w: 230, h: 62, t: 'Bank still confirming →\norder appears shortly' },
    { id: 'o4', kind: 'bad', x: 850, y: 622, w: 260, h: 62, t: 'Sold out / coupon used up →\nfull automatic refund' },
  ],
  edges: [
    { from: 's', to: 'r' }, { from: 'r', to: 'q' }, { from: 'q', to: 'a' }, { from: 'a', to: 'p' }, { from: 'p', to: 'z' }, { from: 'z', to: 'd' },
    { from: 'c', to: 'q', fp: 'l', tp: 'r', dashed: true, label: 're-price' },
    { from: 'd', to: 'o1' }, { from: 'd', to: 'o2' }, { from: 'd', to: 'o3' }, { from: 'd', to: 'o4' },
  ],
});

D.support = flow({
  width: 1000, height: 640,
  nodes: [
    { id: 's', kind: 'start', x: 500, y: 36, w: 240, h: 44, t: 'Customer needs help' },
    { id: 'd', kind: 'decision', x: 500, y: 128, w: 230, h: 76, t: 'Quick question?' },
    { id: 'chat', kind: 'info', x: 215, y: 240, w: 300, h: 70, t: 'Chat assistant (Gemini) checks your\norders & payments, finds products,\nadds items to the cart' },
    { id: 'tk', x: 785, y: 240, w: 300, h: 62, t: 'Support page: open a ticket\nsubject · category · optional order' },
    { id: 'ans', kind: 'decision', x: 215, y: 370, w: 200, h: 72, t: 'Answered?' },
    { id: 'done', kind: 'end', x: 215, y: 480, w: 200, h: 46, t: 'Done' },
    { id: 'at', x: 500, y: 370, w: 230, h: 62, t: 'Assistant opens a ticket\n(source: assistant)' },
    { id: 'th', x: 785, y: 370, w: 300, h: 62, t: 'Ticket thread\nadmin replies · customer replies' },
    { id: 'st', x: 785, y: 480, w: 300, h: 62, t: 'Status: open → in progress\n→ resolved → closed' },
    { id: 'em', kind: 'ext', x: 485, y: 480, w: 250, h: 62, t: 'Customer emailed on every\nadmin reply and status change' },
    { id: 'end', kind: 'end', x: 785, y: 590, w: 300, h: 50, t: 'Resolved / closed' },
  ],
  edges: [
    { from: 's', to: 'd' },
    { from: 'd', to: 'chat', fp: 'l', tp: 't', label: 'yes' },
    { from: 'd', to: 'tk', fp: 'r', tp: 't', label: 'no' },
    { from: 'chat', to: 'ans' },
    { from: 'ans', to: 'done', label: 'yes' },
    { from: 'ans', to: 'at', fp: 'r', tp: 'l', label: 'no' },
    { from: 'at', to: 'th', fp: 'r', tp: 'l' },
    { from: 'tk', to: 'th' },
    { from: 'th', to: 'st' },
    { from: 'st', to: 'em', fp: 'l', tp: 'r', dashed: true },
    { from: 'st', to: 'end' },
  ],
});

D.admin = flow({
  width: 1000, height: 500,
  nodes: [
    { id: 'c', kind: 'start', x: 500, y: 250, w: 250, h: 70, t: 'Admin dashboard\n/admin · role: admin' },
    { id: 'a1', x: 150, y: 60, w: 270, h: 62, t: 'Overview\nrevenue · IST charts · low stock' },
    { id: 'a2', x: 500, y: 60, w: 270, h: 62, t: 'Products\nup to 6 photos · search · stock' },
    { id: 'a3', x: 850, y: 60, w: 270, h: 62, t: 'Orders\nstatus · cancel & refund · returns' },
    { id: 'a9', x: 150, y: 195, w: 250, h: 62, t: 'Categories\nadd · rename · reorder · delete' },
    { id: 'a4', x: 150, y: 305, w: 250, h: 62, t: 'Coupons\n4 types · limits · pause/resume' },
    { id: 'a5', x: 850, y: 250, w: 250, h: 62, t: 'Reviews\nfilter · hide / show' },
    { id: 'a6', x: 150, y: 440, w: 270, h: 62, t: 'Tickets\nreply · change status (paged)' },
    { id: 'a7', x: 500, y: 440, w: 270, h: 62, t: 'Users\nroles · filter · Excel' },
    { id: 'a8', x: 850, y: 440, w: 270, h: 62, t: 'Search\norders · payments · customers' },
  ],
  edges: [
    { from: 'c', to: 'a1', fp: 't', tp: 'b', sdx: -60 }, { from: 'c', to: 'a2', fp: 't', tp: 'b' }, { from: 'c', to: 'a3', fp: 't', tp: 'b', sdx: 60 },
    { from: 'c', to: 'a9', fp: 'l', tp: 'r', sdy: -15 }, { from: 'c', to: 'a4', fp: 'l', tp: 'r', sdy: 15 }, { from: 'c', to: 'a5', fp: 'r', tp: 'l' },
    { from: 'c', to: 'a6', fp: 'b', tp: 't', sdx: -60 }, { from: 'c', to: 'a7', fp: 'b', tp: 't' }, { from: 'c', to: 'a8', fp: 'b', tp: 't', sdx: 60 },
  ],
});

// ===================== API workflows (sequence diagrams) =====================
const P = {
  B: (sub) => ({ id: 'B', name: 'Browser', sub, kind: 'client' }),
  A: (sub) => ({ id: 'A', name: 'API (Express)', sub }),
  D: (sub = 'Atlas') => ({ id: 'D', name: 'MongoDB', sub }),
  E: { id: 'E', name: 'Email', sub: 'Resend / Gmail', kind: 'ext' },
  R: { id: 'R', name: 'Razorpay', sub: 'payments', kind: 'ext' },
  G: { id: 'G', name: 'Google Gemini', sub: 'AI model', kind: 'ext' },
};

D.seqSignup = sequence({
  participants: [P.B('AuthPage · VerifyEmail'), P.A('/api/auth'), P.D('users'), P.E],
  rows: [
    { from: 'B', to: 'A', label: 'POST /register\n{name, email, password, leaveBlank, formElapsedMs}' },
    { note: 'authLimiter → signupLimiter → spamGuard (bot → identical 201 reply, nothing saved)\nvalidate: name 1–120 chars · email ≤ 254 · password 8–72 bytes', over: ['A'] },
    { from: 'A', to: 'D', label: 'find user by email' },
    { from: 'D', to: 'A', label: 'none, or an unverified account', reply: true },
    { from: 'A', to: 'A', label: 'bcrypt hash (cost 12) · code → HMAC-SHA256' },
    { from: 'A', to: 'D', label: 'create user (verified: false), or replace\nthe unverified account’s name + password' },
    { from: 'A', to: 'E', label: 'send 6-digit code (valid 10 min)' },
    { from: 'A', to: 'B', label: '201 {email, emailSent}', reply: true },
    { from: 'E', to: 'B', label: 'code arrives in the inbox', reply: true },
    { section: 'Verify the email' },
    { from: 'B', to: 'A', label: 'POST /verify-email {email, otp, password}' },
    { from: 'A', to: 'D', label: 'load code hash, expiry, attempts' },
    { from: 'A', to: 'A', label: 'timing-safe compare · check password · ≤ 5 wrong tries' },
    { from: 'A', to: 'D', label: 'verified: true · clear code fields' },
    { from: 'A', to: 'B', label: '200 {user, token} (JWT, 30 days)', reply: true },
    { note: 'Already-verified email → 409 · login is refused (403) until verified · resend: 1 per 60 s, always a generic reply', over: ['B', 'D'] },
  ],
});

D.seqLogin = sequence({
  participants: [P.B('AuthContext'), P.A('auth + protect'), P.D('users · orders')],
  rows: [
    { from: 'B', to: 'A', label: 'POST /api/auth/login {email, password}   (authLimiter)' },
    { from: 'A', to: 'D', label: 'find user (with password hash)' },
    { from: 'A', to: 'A', label: 'bcrypt compare · must be verified' },
    { from: 'A', to: 'B', label: '200 {_id, name, email, role, token}', reply: true },
    { from: 'B', to: 'B', label: 'store in localStorage “userInfo”; expiry checked on load' },
    { section: 'Every signed-in request' },
    { from: 'B', to: 'A', label: 'GET /api/orders/myorders\nAuthorization: Bearer <JWT>' },
    { from: 'A', to: 'A', label: 'protect: verify JWT · load user · token older than\npasswordChangedAt? → 401' },
    { from: 'A', to: 'D', label: 'Order.find({ user })' },
    { from: 'A', to: 'B', label: '200 [orders]', reply: true },
    { note: 'Any 401 → “session expired” event → signed out on this device · unverified login → 403 → /verify-email', over: ['B', 'D'] },
  ],
});

D.seqReset = sequence({
  participants: [P.B('ForgotPassword · ResetPassword'), P.A('/api/auth'), P.D('users'), P.E],
  rows: [
    { from: 'B', to: 'A', label: 'POST /forgot-password {email, leaveBlank}' },
    { note: 'otpLimiter · spamGuard · same reply whether or not the account exists', over: ['A'] },
    { from: 'A', to: 'D', label: 'find user · last link sent ≥ 60 s ago?' },
    { from: 'A', to: 'A', label: '32 random bytes → store only SHA-256 hash (30 min)' },
    { from: 'A', to: 'E', label: 'link: <shop>/reset-password?token=…' },
    { from: 'A', to: 'B', label: '200 generic message', reply: true },
    { from: 'E', to: 'B', label: 'email with the link', reply: true },
    { section: 'Choose a new password' },
    { from: 'B', to: 'B', label: 'read token, remove it from the address bar' },
    { from: 'B', to: 'A', label: 'POST /reset-password {token, password}' },
    { from: 'A', to: 'D', label: 'atomic findOneAndUpdate(hash, not expired)\n→ clear hash (single use)' },
    { from: 'A', to: 'D', label: 'new bcrypt hash · passwordChangedAt · verified: true' },
    { from: 'A', to: 'B', label: '200 {user, token} — other devices signed out', reply: true },
  ],
});

D.seqPay = sequence({
  participants: [P.B('Checkout page'), P.A('/api/payment'), P.D('products · intents'), P.R, P.E],
  rows: [
    { from: 'B', to: 'A', label: 'POST /quote {items, couponCode}' },
    { from: 'A', to: 'D', label: 'products, coupon, usage' },
    { from: 'A', to: 'B', label: 'subtotal · shipping · discount · total', reply: true },
    { section: 'Create the payment' },
    { from: 'B', to: 'A', label: 'POST /order {items, address, couponCode}' },
    { from: 'A', to: 'A', label: 'validate address · re-price (refuse if the coupon changed)' },
    { from: 'A', to: 'R', label: 'orders.create(amount in paise, INR)' },
    { from: 'R', to: 'A', label: 'razorpayOrderId', reply: true },
    { from: 'A', to: 'D', label: 'PaymentIntent (status: pending)' },
    { from: 'A', to: 'B', label: '201 {keyId, amount, razorpayOrderId, allowed methods}', reply: true },
    { from: 'B', to: 'R', label: 'open Razorpay Checkout · customer pays' },
    { from: 'R', to: 'B', label: '{payment_id, order_id, signature}', reply: true },
    { section: 'Verify and fulfil' },
    { from: 'B', to: 'A', label: 'POST /verify {payment_id, order_id, signature}' },
    { from: 'A', to: 'A', label: 'HMAC-SHA256(order_id|payment_id) · timing-safe' },
    { from: 'A', to: 'R', label: 'payments.fetch → check order, amount, INR\n(capture if only authorised)' },
    { from: 'A', to: 'D', label: 'transaction while intent is pending: redeem coupon,\nstock −= qty (only if enough), create Order, intent → completed' },
    { from: 'A', to: 'E', label: 'send e-bill' },
    { from: 'A', to: 'B', label: '201 order → cart cleared → My orders', reply: true },
    { note: 'Sold out · coupon used up · payment method not allowed · account deleted\n→ transaction aborts → intent refund_pending → Razorpay full refund\n→ refunded (or refund_failed: refund manually) → 409 {refunded}', over: ['A', 'R'], tone: 'bad' },
  ],
});

D.seqWebhook = sequence({
  participants: [P.R, P.A('/api/payment/webhook'), P.D('intents · orders'), P.E],
  rows: [
    { from: 'R', to: 'A', label: 'POST webhook · event payment.captured (raw body)' },
    { from: 'A', to: 'A', label: 'HMAC-SHA256(raw body, webhook secret) = x-razorpay-signature?' },
    { from: 'A', to: 'D', label: 'find PaymentIntent by order_id · check amount + INR' },
    { note: 'Intent no longer pending (already fulfilled by /verify) → 200 “already_processed”', over: ['A', 'D'] },
    { from: 'A', to: 'D', label: 'same fulfilment transaction as /verify' },
    { from: 'A', to: 'E', label: 'e-bill (if this call created the order)' },
    { from: 'A', to: 'R', label: '200 OK  (errors → 500, so Razorpay retries)', reply: true },
    { note: 'No double orders: fulfilment runs only while the intent is pending, and Order.paymentId is unique', over: ['A', 'D'], tone: 'ok' },
  ],
});

D.seqChat = sequence({
  participants: [P.B('ChatWidget'), P.A('/api/chat'), P.D('conversations · orders'), P.G],
  rows: [
    { from: 'B', to: 'A', label: 'POST /messages {message ≤ 1000 chars}  (chatLimiter)' },
    { from: 'A', to: 'D', label: 'lock conversation (busyUntil +5 min) · turns < 30' },
    { from: 'A', to: 'G', label: 'generateContent(history + 7 tools)' },
    { from: 'G', to: 'A', label: 'function call, e.g. list_my_orders', reply: true },
    { from: 'A', to: 'D', label: 'run the tool for this customer only' },
    { from: 'A', to: 'G', label: 'tool result (data, never instructions)' },
    { note: 'Up to 6 tool rounds · progress saved after each round, so actions never repeat\nmodel busy → 2 tries, then the fallback model', over: ['A', 'G'] },
    { from: 'G', to: 'A', label: 'final text answer', reply: true },
    { from: 'A', to: 'D', label: 'save history + transcript · release lock' },
    { from: 'A', to: 'B', label: '{message, actions, turnsLeft}', reply: true },
    { from: 'B', to: 'B', label: 'apply add-to-cart actions · refresh Support page if a ticket opened' },
  ],
});

// ===================== LLD =====================
D.pipeline = flow({
  width: 1000, height: 380,
  nodes: [
    { id: 'req', kind: 'start', x: 95, y: 60, w: 160, t: 'HTTPS request' },
    { id: 'sec', x: 290, y: 60, w: 190, t: 'helmet · CORS\nallow-listed origins' },
    { id: 'body', x: 495, y: 60, w: 190, t: 'Body parsers\nJSON ≤ 100 kb' },
    { id: 'rt', x: 700, y: 60, w: 180, t: 'Router\n/api/<area>' },
    { id: 'lim', kind: 'ext', x: 895, y: 60, w: 170, t: 'Rate limiter\nper IP or user' },
    { id: 'sp', kind: 'ext', x: 895, y: 190, w: 170, t: 'spamGuard\n(auth forms)' },
    { id: 'pr', kind: 'ext', x: 700, y: 190, w: 180, t: 'protect\nJWT → req.user' },
    { id: 'ad', kind: 'ext', x: 495, y: 190, w: 190, t: 'admin\nrole === "admin"' },
    { id: 'ct', x: 290, y: 190, w: 190, t: 'Controller\nvalidate → act' },
    { id: 'wh', kind: 'info', x: 95, y: 190, w: 160, h: 66, t: 'Webhook route:\nraw body, before\nJSON parser' },
    { id: 'ut', x: 290, y: 320, w: 190, t: 'Utils\npricing · email · AI' },
    { id: 'md', x: 495, y: 320, w: 190, t: 'Mongoose model\nschema validation' },
    { id: 'db', kind: 'ext', x: 700, y: 320, w: 180, t: 'MongoDB Atlas' },
    { id: 'er', kind: 'bad', x: 895, y: 320, w: 170, h: 66, t: 'Error handler\n(any step)\nsafe 4xx / 5xx text' },
  ],
  edges: [
    { from: 'req', to: 'sec', fp: 'r', tp: 'l' }, { from: 'sec', to: 'body', fp: 'r', tp: 'l' }, { from: 'body', to: 'rt', fp: 'r', tp: 'l' },
    { from: 'rt', to: 'lim', fp: 'r', tp: 'l' }, { from: 'lim', to: 'sp' }, { from: 'sp', to: 'pr', fp: 'l', tp: 'r' },
    { from: 'pr', to: 'ad', fp: 'l', tp: 'r' }, { from: 'ad', to: 'ct', fp: 'l', tp: 'r' }, { from: 'req', to: 'wh', dashed: true },
    { from: 'ct', to: 'ut' }, { from: 'ut', to: 'md', fp: 'r', tp: 'l' }, { from: 'md', to: 'db', fp: 'r', tp: 'l' },
  ],
});

D.frontend = flow({
  width: 1000, height: 470,
  frames: [{ x: 735, y: 14, w: 255, h: 350, t: 'Shared helpers (src/)' }],
  nodes: [
    { id: 'i', kind: 'start', x: 370, y: 40, w: 260, h: 46, t: 'index.jsx · React 19 root' },
    { id: 'au', x: 370, y: 120, w: 280, t: 'AuthProvider\nuser · login · logout · session expiry' },
    { id: 'ca', x: 370, y: 205, w: 280, t: 'CartProvider\ncart per account · refreshCart()' },
    { id: 'ap', x: 370, y: 290, w: 280, t: 'App · BrowserRouter\nScrollToTop · Navbar · Footer' },
    { id: 'e', x: 120, y: 410, w: 220, h: 62, t: 'Loaded with the app\nHome · Shop · ProductDetail' },
    { id: 'l', x: 370, y: 410, w: 250, h: 62, t: '16 lazy pages (Suspense)\nCart · Checkout · Orders · Admin…' },
    { id: 'w', x: 618, y: 410, w: 220, h: 62, t: 'Always mounted\nChatWidget · ConsentBanner' },
    { id: 'h1', kind: 'info', x: 862, y: 70, w: 225, t: 'api.js\nfetch wrapper · VITE_API_URL' },
    { id: 'h2', kind: 'info', x: 862, y: 145, w: 225, t: 'usePageMeta.js\ntitle · description · OG' },
    { id: 'h3', kind: 'info', x: 862, y: 220, w: 225, t: 'imageUrl.js · money.js\nCloudinary sizes · ₹ format' },
    { id: 'h4', kind: 'info', x: 862, y: 295, w: 225, t: 'useCategories.js · consent.js\ncategories · analytics choice' },
  ],
  edges: [
    { from: 'i', to: 'au' }, { from: 'au', to: 'ca' }, { from: 'ca', to: 'ap' },
    { from: 'ap', to: 'e' }, { from: 'ap', to: 'l' }, { from: 'ap', to: 'w' },
  ],
});

D.pricing = flow({
  width: 1000, height: 580,
  nodes: [
    { id: 's', kind: 'start', x: 200, y: 40, w: 260, h: 46, t: 'Cart items + optional coupon' },
    { id: 'l', x: 200, y: 125, w: 300, h: 66, t: 'Load products (beauty categories)\n1–50 lines · qty 1–99 · in stock\nmissing → 409 + unavailableProductIds' },
    { id: 'sub', x: 200, y: 215, w: 300, t: 'Subtotal = Σ price × qty\n(integer paise)' },
    { id: 'sh', x: 200, y: 298, w: 300, t: 'Shipping = ₹49 if subtotal < ₹499,\notherwise free' },
    { id: 'cq', kind: 'decision', x: 200, y: 395, w: 220, h: 76, t: 'Coupon\nentered?' },
    { id: 'nc', x: 200, y: 515, w: 300, t: 'Total = subtotal + shipping\n(no coupon)' },
    { id: 'st', kind: 'decision', x: 560, y: 120, w: 270, h: 96, t: 'Coupon usable now?\nactive · started · not expired\n· not used up' },
    { id: 'el', kind: 'decision', x: 560, y: 250, w: 270, h: 96, t: 'Customer eligible?\nallowed users · per-user limit\n· min cart · products' },
    { id: 'ds', x: 560, y: 370, w: 300, h: 66, t: 'Discount by type: % · fixed ·\nfree shipping · buy X get Y\n(capped by maxDiscount)' },
    { id: 'cl', x: 560, y: 455, w: 300, t: 'Clamp so the total stays ≥ ₹1\n(Razorpay minimum, 100 paise)' },
    { id: 'end', kind: 'end', x: 560, y: 535, w: 300, h: 54, t: 'Quote: subtotal · shipping ·\ndiscount · savings · total' },
    { id: 'ce', kind: 'info', x: 875, y: 185, w: 210, h: 66, t: 'Price without the\ncoupon + couponError\n(shown to the customer)' },
  ],
  edges: [
    { from: 's', to: 'l' }, { from: 'l', to: 'sub' }, { from: 'sub', to: 'sh' }, { from: 'sh', to: 'cq' },
    { from: 'cq', to: 'nc', label: 'no' },
    { from: 'cq', to: 'st', fp: 'r', tp: 'l', label: 'yes', l: [380, 395] },
    { from: 'st', to: 'el', label: 'yes' }, { from: 'el', to: 'ds', label: 'yes' }, { from: 'ds', to: 'cl' }, { from: 'cl', to: 'end' },
    { from: 'st', to: 'ce', fp: 'r', tp: 't', label: 'no' },
    { from: 'el', to: 'ce', fp: 'r', tp: 'b', label: 'no' },
    { from: 'nc', to: 'end', fp: 'r', tp: 'l' },
  ],
});

D.states = flow({
  width: 1000, height: 520,
  frames: [
    { x: 10, y: 10, w: 480, h: 500, t: 'Payment record (PaymentIntent.status)' },
    { x: 505, y: 10, w: 485, h: 235, t: 'Order.status' },
    { x: 505, y: 260, w: 485, h: 250, t: 'Ticket.status' },
  ],
  nodes: [
    { id: 'p', kind: 'info', x: 120, y: 85, w: 160, h: 46, t: 'pending' },
    { id: 'c', kind: 'end', x: 375, y: 85, w: 170, h: 46, t: 'completed' },
    { id: 'rp', kind: 'ext', x: 120, y: 245, w: 170, h: 46, t: 'refund_pending' },
    { id: 'rd', kind: 'end', x: 375, y: 245, w: 170, h: 46, t: 'refunded' },
    { id: 'rf', kind: 'bad', x: 375, y: 370, w: 170, h: 46, t: 'refund_failed' },
    { id: 'o1', kind: 'info', x: 585, y: 80, w: 130, h: 44, t: 'pending' },
    { id: 'o2', kind: 'info', x: 745, y: 80, w: 130, h: 44, t: 'shipped' },
    { id: 'o3', kind: 'end', x: 905, y: 80, w: 130, h: 44, t: 'delivered' },
    { id: 'o4', kind: 'step', x: 585, y: 200, w: 130, h: 44, t: 'cancelled' },
    { id: 'o5', kind: 'step', x: 825, y: 200, w: 130, h: 44, t: 'returned' },
    { id: 't1', kind: 'info', x: 585, y: 390, w: 130, h: 44, t: 'open' },
    { id: 't2', kind: 'info', x: 745, y: 390, w: 140, h: 44, t: 'in_progress' },
    { id: 't3', kind: 'end', x: 910, y: 390, w: 130, h: 44, t: 'resolved' },
    { id: 't4', kind: 'step', x: 910, y: 478, w: 130, h: 44, t: 'closed' },
  ],
  edges: [
    { from: 'p', to: 'c', fp: 'r', tp: 'l', label: 'fulfilled (verify or webhook)', l: [248, 52] },
    { from: 'p', to: 'rp', label: 'sold out · coupon used up\n· method not allowed\n· account deleted', l: [120, 165] },
    { from: 'rp', to: 'rd', fp: 'r', tp: 'l', label: 'refund OK' },
    { from: 'rp', to: 'rf', fp: 'b', tp: 'l', label: 'refund error →\nrefund manually', l: [205, 370] },
    { from: 'o1', to: 'o2', fp: 'r', tp: 'l', label: 'admin', l: [665, 62] },
    { from: 'o2', to: 'o3', fp: 'r', tp: 'l', label: 'admin', l: [825, 62] },
    { from: 'o1', to: 'o4', label: 'cancel: customer\nor admin + refund', l: [585, 141] },
    { from: 'o2', to: 'o5', tdx: -35, label: 'return (admin)\n+ refund', l: [825, 141] },
    { from: 'o3', to: 'o5', tdx: 35 },
    { from: 't1', to: 't2', fp: 'r', tp: 'l', label: 'admin replies', l: [665, 344] },
    { from: 't2', to: 't3', fp: 'r', tp: 'l' },
    { from: 't3', to: 't4' },
    { from: 't3', to: 't1', fp: 'b', tp: 'b', sdx: -60, via: [[850, 440], [585, 440]], label: 'customer replies', l: [715, 440], dashed: true },
  ],
});

// ER diagram, laid out by hand.
D.er = (() => {
  const parts = [];
  const box = (x, y, w, name, fields, opts) => { const e = entity(x, y, w, name, fields, opts); parts.push(e.svg); return { x, y, w, h: e.h }; };
  const product = box(12, 26, 232, 'Product', [['_id', 'PK'], ['name', '≤ 120'], ['description', '≤ 5000'], ['price', '₹, > 0'], ['category', 'name → Category'], ['stock', 'integer ≥ 0'], ['imageUrls', 'main photo'], ['images[]', 'up to 6 photos'], ['numReviews', 'visible only'], ['ratingCounts', 'bad/good/excellent'], ['createdAt', 'date']]);
  box(280, 26, 210, 'Review', [['_id', 'PK'], ['product', 'FK → Product'], ['user', 'FK → User'], ['name', '“Priya S.”'], ['rating', 'bad|good|excellent'], ['comment', '10–1000'], ['verifiedBuyer', 'bool'], ['hidden · hiddenAt', 'moderation'], ['(product, user)', 'UQ']]);
  const chat = box(514, 26, 222, 'ChatConversation', [['user', 'FK UQ → User'], ['apiMessages', 'Gemini history'], ['transcript[]', 'role · text · actions'], ['turns', '≤ 30'], ['busyUntil', 'lock']]);
  const order = box(760, 26, 228, 'Order', [['_id', 'PK'], ['user', 'FK → User'], ['items[]', 'productId FK · qty · price'], ['totalAmount', '₹ paid'], ['subtotalAmount', '₹'], ['shippingFee', '₹'], ['discountAmount', '₹'], ['couponCode', 'text'], ['paymentMethod', 'upi/card/…'], ['address', 'name … phone'], ['paymentId', 'UQ (sparse)'], ['status', 'pending … returned'], ['refund · closedAt', 'cancel / return']]);
  const user = box(514, 222, 222, 'User', [['_id', 'PK'], ['name', 'text'], ['email', 'UQ'], ['password', 'bcrypt hash'], ['role', 'user | admin'], ['verified', 'bool'], ['OTP / reset fields', 'hashed, hidden'], ['passwordChangedAt', 'date']]);
  const intent = box(760, 300, 228, 'PaymentIntent', [['_id', 'PK'], ['user', 'FK → User'], ['items[] · address', 'snapshot'], ['razorpayOrderId', 'UQ'], ['amountPaise', 'charged'], ['subtotalPaise', 'paise'], ['discountPaise', 'all savings'], ['coupon', '{id FK, code}'], ['paymentId', 'Razorpay'], ['order', 'FK → Order'], ['status', '5 states'], ['refundId · failureReason', '']]);
  box(514, 420, 222, 'Ticket', [['_id', 'PK'], ['user', 'FK → User'], ['subject · description', 'text'], ['category', '8 options'], ['order', 'FK → Order (opt.)'], ['status', 'open … closed'], ['source', 'customer|assistant'], ['messages[]', 'author · body'], ['lastActivityAt', 'date']]);
  box(280, 330, 210, 'Category', [['_id', 'PK'], ['name', 'UQ'], ['description', '≤ 200'], ['icon · sortOrder', 'display']]);
  const coupon = box(12, 330, 232, 'Coupon', [['code', 'UQ, uppercase'], ['discountType', '4 types'], ['discountValue', 'number'], ['buy / getQuantity', 'buy X get Y'], ['minCartValue · maxDiscount', '₹'], ['startsAt · expiresAt', 'dates'], ['usageLimit · usedCount', 'total'], ['perUserLimit', 'per customer'], ['applicableProducts', 'FK[] → Product'], ['applicableCategories', 'names → Category'], ['applicableUsers', 'FK[] → User'], ['paymentMethods', 'upi/card/…'], ['isActive · showToCustomers', 'bool']]);
  box(280, 520, 210, 'CouponUsage', [['coupon', 'FK → Coupon'], ['user', 'FK → User'], ['count', 'uses'], ['(coupon, user)', 'UQ']]);
  const ln = (d, label, lx, ly, anchor = 'middle') => {
    parts.push(`<path d="${d}" fill="none" stroke="${C.brand}" stroke-width="1.5"/>`);
    if (label) parts.push(textBlock(lx, ly, label, { size: 10.6, weight: 600, fill: C.brand, anchor, halo: true }));
  };
  // relationships (1 → many)
  ln(`M244,100 H280`, '1→*', 262, 88);                                       // Product–Review
  ln(`M490,140 H502 V262 H514`, '', 0, 0);                                   // Review–User
  ln(`M625,${chat.y + chat.h} V222`, '1 : 1', 640, 205, 'start');            // Chat–User
  ln(`M736,262 H748 V110 H760`, '1→*', 748, 186);                            // User–Order
  ln(`M736,330 H760`, '1→*', 748, 318);                                      // User–PaymentIntent
  ln(`M874,${order.y + order.h} V300`, 'creates 0..1', 882, 284, 'start');   // Intent–Order
  ln(`M625,${user.y + user.h} V420`, '1→*', 640, 402, 'start');              // User–Ticket
  ln(`M490,560 H502 V350 H514`, '', 0, 0);                                   // CouponUsage–User
  ln(`M280,560 H244`, '', 0, 0);                                             // CouponUsage–Coupon
  ln(`M280,360 H262 V200 H244`, '', 0, 0);                                   // Category–Product (by name)
  ln(`M280,410 H244`, '', 0, 0);                                             // Category–Coupon (by name)
  ln(`M128,${product.y + product.h} V330`, 'restricts to', 136, 284, 'start'); // Coupon–Product
  ln(`M874,${intent.y + intent.h} V700 H128 V${coupon.y + coupon.h}`, 'PaymentIntent.coupon → Coupon', 500, 700); // Intent–Coupon
  ln(`M874,26 V12 H128 V26`, 'Order.items[].productId → Product', 500, 12);
  const h = 712;
  return `${svgOpen(1000, h, 'er')}${parts.join('')}</svg>`;
})();

D.seqCancel = sequence({
  participants: [P.B('My orders · admin Orders tab'), P.A('/api/orders'), P.D('orders · products · coupons'), P.R, P.E],
  rows: [
    { from: 'B', to: 'A', label: 'POST /:id/cancel  (customer: own pending order)\nor POST /:id/return {restock}  (admin: shipped/delivered)' },
    { from: 'A', to: 'D', label: 'find the order · check its status' },
    { section: 'One transaction' },
    { from: 'A', to: 'D', label: 'findOneAndUpdate(status still allowed) → cancelled / returned,\nrefund {status: pending, amount}' },
    { from: 'A', to: 'D', label: 'stock += qty (cancel, or return with restock)' },
    { from: 'A', to: 'D', label: 'cancel only: that checkout\'s coupon usedCount −1, customer use −1' },
    { note: 'A second click or another admin finds the status already changed → 409, no second refund', over: ['A', 'D'], tone: 'ok' },
    { from: 'A', to: 'R', label: 'payments.refund(paymentId, full amount in paise)' },
    { from: 'R', to: 'A', label: 'refund id', reply: true },
    { from: 'A', to: 'D', label: 'refund.status = refunded (or failed + error)' },
    { from: 'A', to: 'E', label: '“Order cancelled” / “Return received” with the refund' },
    { from: 'A', to: 'B', label: '200 {message, order}', reply: true },
    { note: 'Refund failed → admins emailed, listed under Refund problems;\nRetry refund (POST /:id/refund) checks Razorpay before refunding', over: ['A', 'R'], tone: 'bad' },
  ],
});

module.exports = D;
