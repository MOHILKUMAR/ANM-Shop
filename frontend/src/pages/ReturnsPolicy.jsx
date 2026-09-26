import { supportEmail } from "../data/contactInfo.js";

function ReturnsPolicy() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">ANM-Shop policies</p>
      <h1 className="mt-3 text-4xl font-semibold text-gray-900">Returns and refunds</h1>
      <p className="mt-3 text-sm text-gray-500">Draft for review before launch. Last updated September 26, 2026.</p>
      <div className="mt-8 rounded-xl border border-accent-100 bg-accent-50 p-5 text-sm leading-6 text-brand-900">
        This is a proposed starting policy. Confirm the return window, shipping responsibility, and refund timing for your business and applicable consumer laws before treating it as final.
      </div>
      <div className="mt-10 space-y-8 text-gray-700">
        <section><h2 className="text-xl font-semibold text-gray-900">Eligible returns</h2><p className="mt-2 leading-7">For hygiene and safety, cosmetics and personal-care items should be unused, unopened, and in their original packaging to be considered for return, except where an item arrives damaged, defective, or incorrect. Some products may be non-returnable where required for health or safety reasons.</p></section>
        <section><h2 className="text-xl font-semibold text-gray-900">Requesting help</h2><p className="mt-2 leading-7">Contact us with your order number, the item name, and a description of the issue. For damaged or incorrect deliveries, include clear photos of the item and packaging. Please contact us before sending anything back so we can provide instructions.</p></section>
        <section><h2 className="text-xl font-semibold text-gray-900">Refunds</h2><p className="mt-2 leading-7">If a return or refund is approved, the refund will be issued to the original payment method where possible. Processing and posting times depend on the payment provider and your bank. Shipping fees, promotional purchases, and partial orders may be handled according to the final terms shown at checkout.</p></section>
        <section><h2 className="text-xl font-semibold text-gray-900">Order changes</h2><p className="mt-2 leading-7">If you need to change or cancel an order, contact us as soon as possible. We may be unable to change an order once it has been processed or dispatched.</p></section>
        <section><h2 className="text-xl font-semibold text-gray-900">Contact</h2><p className="mt-2 leading-7">For a return or refund request, email <a className="font-medium text-brand-700 underline" href={`mailto:${supportEmail}`}>{supportEmail}</a> with your order number.</p></section>
      </div>
    </main>
  );
}

export default ReturnsPolicy;
