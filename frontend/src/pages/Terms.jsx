import { Link } from "react-router-dom";
import { supportEmail } from "../data/contactInfo.js";
import { usePageMeta } from "../usePageMeta.js";

const sections = [
  ["About these terms", <>These terms apply when you browse ANM-Shop, create an account, or place an order. By using the store you agree to them, together with our <Link className="font-medium text-brand-700 underline" to="/privacy">Privacy policy</Link> and <Link className="font-medium text-brand-700 underline" to="/returns">Returns and refunds policy</Link>. If you do not agree, please do not use the store.</>],
  ["Your account", <>You need an account with a verified email address to place orders, write reviews, and use support. Keep your password private; you are responsible for activity on your account. Tell us straight away at {supportEmail} if you think someone else has used it. We may suspend or close accounts that break these terms or are used for fraud or abuse.</>],
  ["Products and prices", <>We describe products and show their pictures as accurately as we can, but colours and packaging may differ slightly from what you see on screen. Prices are in Indian rupees (₹) and are confirmed by our server at checkout; the amount shown on the payment button is the amount charged. If a product sells out or a price is wrong, we may cancel the order and refund you in full.</>],
  ["Orders and payment", <>An order is placed only when your payment through Razorpay succeeds; you then receive an order number and an e-bill by email. ANM-Shop does not see or store your card or bank details. If an item sells out while you are paying, or a coupon can no longer be applied, the order is not created and the payment is refunded automatically, usually within 5 to 7 working days.</>],
  ["Shipping", <>We deliver within India to the address you enter at checkout. Shipping is ₹49 on orders under ₹499 of products and free above that, unless a coupon says otherwise. Delivery times are estimates; you can follow your order status (pending, shipped, delivered) under My orders.</>],
  ["Coupons", <>One coupon can be used per order. Each coupon may have its own conditions, such as a minimum order value, eligible products or categories, a usage limit, an expiry date, or accepted payment methods; these are shown at checkout and in My coupons. Coupons have no cash value and cannot be exchanged or combined. We may change or end a coupon at any time; orders already placed keep their discount.</>],
  ["Returns and refunds", <>Returns, cancellations, and refunds follow our <Link className="font-medium text-brand-700 underline" to="/returns">Returns and refunds policy</Link>. Nothing in these terms limits your rights under Indian consumer protection law.</>],
  ["Reviews", <>Reviews must be your own honest experience of the product. Do not post anything offensive, misleading, or unlawful, personal information, or advertising. Reviews show your first name and the initial of your last name. We may hide reviews that break these rules. By posting a review you allow ANM-Shop to display it on the store.</>],
  ["Support and the chat assistant", <>The chat assistant is an automated AI tool. It can look up your own orders, payments, and tickets and add products to your cart, but it can make mistakes and cannot cancel orders, issue refunds, or make promises on our behalf. Check important details on your order pages, and open a support ticket when you need our team.</>],
  ["Acceptable use", <>Do not misuse the store: no attempts to break its security, overload it, scrape it, place fraudulent orders, or use another person's account or payment method.</>],
  ["Our content", <>The ANM-Shop name, logo, design, and content belong to ANM-Shop or its licensors. You may not copy or reuse them without permission.</>],
  ["Liability", <>We provide the store with reasonable care and skill. To the extent the law allows, we are not responsible for losses that were not foreseeable, that result from your misuse of a product or the store, or that are caused by events beyond our reasonable control. Our total liability for an order is limited to the amount you paid for it. Always read product labels and patch test new skincare and cosmetics.</>],
  ["Changes and governing law", <>We may update these terms; the version on this page when you place an order applies to that order. These terms are governed by the laws of India, and disputes are subject to the jurisdiction of the courts of India.</>],
  ["Contact", <>Questions about these terms? Email <a className="font-medium text-brand-700 underline" href={`mailto:${supportEmail}`}>{supportEmail}</a> or open a ticket on the Support page.</>],
];

function Terms() {
  usePageMeta({
    title: "Terms and conditions",
    description: "The terms for using ANM-Shop: accounts, orders and payment, shipping, coupons, reviews, the support assistant, and your rights.",
  });
  return (
    <main className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">ANM-Shop policies</p>
      <h1 className="mt-3 text-4xl font-semibold text-gray-900">Terms and conditions</h1>
      <p className="mt-3 text-sm text-gray-500">Last updated 4 October 2026.</p>
      <div className="mt-10 space-y-8 text-gray-700">
        {sections.map(([heading, body]) => (
          <section key={heading}>
            <h2 className="text-xl font-semibold text-gray-900">{heading}</h2>
            <p className="mt-2 leading-7">{body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}

export default Terms;
