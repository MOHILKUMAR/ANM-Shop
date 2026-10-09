import { supportEmail } from "../data/contactInfo.js";
import { usePageMeta } from "../usePageMeta.js";

function ReturnsPolicy() {
  usePageMeta({
    title: "Returns and refunds",
    description: "ANM-Shop's return and refund policy: which beauty products can be returned, how to request a return, and when refunds arrive.",
  });
  return (
    <main className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">ANM-Shop policies</p>
      <h1 className="mt-3 text-4xl font-semibold text-gray-900">Returns and refunds</h1>
      <p className="mt-3 text-sm text-gray-500">Last updated 10 October 2026.</p>
      <div className="mt-10 space-y-8 text-gray-700">
        <section><h2 className="text-xl font-semibold text-gray-900">Eligible returns</h2><p className="mt-2 leading-7">For hygiene and safety, cosmetics and personal-care items should be unused, unopened, and in their original packaging to be considered for return, except where an item arrives damaged, defective, or incorrect. Some products may be non-returnable where required for health or safety reasons.</p></section>
        <section><h2 className="text-xl font-semibold text-gray-900">Requesting help</h2><p className="mt-2 leading-7">Open a ticket on the Support page (or email us) with your order number, the item name, and a description of the issue. For damaged or incorrect deliveries, include clear photos of the item and packaging. Please contact us before sending anything back so we can provide instructions.</p></section>
        <section><h2 className="text-xl font-semibold text-gray-900">Refunds</h2><p className="mt-2 leading-7">If a return or refund is approved, the refund will be issued to the original payment method where possible, usually within 5 to 7 working days. If an item sells out or a coupon stops applying while you are paying, the order is not created and your payment is refunded automatically. Posting times depend on Razorpay and your bank. Shipping fees, promotional purchases, and partial orders may be handled according to the final terms shown at checkout.</p></section>
        <section><h2 className="text-xl font-semibold text-gray-900">Order changes</h2><p className="mt-2 leading-7">You can cancel an order yourself on the My orders page until it ships. The full amount you paid, including shipping, is refunded to your original payment method, usually within 5 to 7 working days. Once an order has shipped it can no longer be cancelled, but it can be returned under this policy. To change an order (for example the delivery address), contact us as soon as possible; we may be unable to change it once it has been dispatched.</p></section>
        <section><h2 className="text-xl font-semibold text-gray-900">Contact</h2><p className="mt-2 leading-7">For a return or refund request, email <a className="font-medium text-brand-700 underline" href={`mailto:${supportEmail}`}>{supportEmail}</a> with your order number.</p></section>
      </div>
    </main>
  );
}

export default ReturnsPolicy;
