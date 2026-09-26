import { supportEmail } from "../data/contactInfo.js";

function PrivacyPolicy() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">ANM-Shop policies</p>
      <h1 className="mt-3 text-4xl font-semibold text-gray-900">Privacy policy</h1>
      <p className="mt-3 text-sm text-gray-500">Draft for review before launch. Last updated September 26, 2026.</p>
      <div className="mt-8 rounded-xl border border-accent-100 bg-accent-50 p-5 text-sm leading-6 text-brand-900">
        This draft describes the data flows currently used by the application. Review it for your business and local legal requirements before publishing it as a final policy.
      </div>
      <div className="mt-10 space-y-8 text-gray-700">
        <section><h2 className="text-xl font-semibold text-gray-900">Information we collect</h2><p className="mt-2 leading-7">When you create an account, we process your name, email address, and password (stored as a protected hash). To fulfil an order, we process the delivery address and the products and quantities ordered. Your cart is stored in your browser so it can remain available between visits.</p></section>
        <section><h2 className="text-xl font-semibold text-gray-900">How we use information</h2><p className="mt-2 leading-7">We use account information for email verification and sign-in, order information to process and deliver purchases, and service messages to provide receipts, e-bills, and support. We also use limited technical data to protect the service and diagnose errors.</p></section>
        <section><h2 className="text-xl font-semibold text-gray-900">Payments and service providers</h2><p className="mt-2 leading-7">Payments are handled by Razorpay. ANM-Shop receives payment and order identifiers but does not store card details. The service uses database, image hosting, and email providers to operate the store. Those providers process information as needed to provide their services and under their own terms.</p></section>
        <section><h2 className="text-xl font-semibold text-gray-900">Storage and security</h2><p className="mt-2 leading-7">We use reasonable technical safeguards and limit access to account and order information to authorized purposes. No internet service can guarantee absolute security. We retain records only as needed to operate the store, meet applicable obligations, and resolve disputes.</p></section>
        <section><h2 className="text-xl font-semibold text-gray-900">Your choices</h2><p className="mt-2 leading-7">You may contact us to request access, correction, or deletion of account information, subject to records we must retain for legal or operational reasons. You can clear your local cart by removing its items in the cart page.</p></section>
        <section><h2 className="text-xl font-semibold text-gray-900">Contact</h2><p className="mt-2 leading-7">For privacy questions, contact <a className="font-medium text-brand-700 underline" href={`mailto:${supportEmail}`}>{supportEmail}</a>.</p></section>
      </div>
    </main>
  );
}

export default PrivacyPolicy;
