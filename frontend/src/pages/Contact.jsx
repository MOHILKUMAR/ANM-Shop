import { supportEmail, linkedinProfile } from "../data/contactInfo.js";

function Contact() {
  return (
    <main className="mx-auto min-h-[65vh] max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">We are here to help</p>
        <h1 className="mt-3 text-4xl font-semibold text-gray-900">Contact ANM-Shop</h1>
        <p className="mt-4 leading-7 text-gray-600">Questions about a product, your order, or your beauty routine? Send us a note and we will get back to you.</p>
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <a className="group rounded-2xl border border-gray-200 bg-white p-7 transition hover:border-brand-300 hover:shadow-lg" href={`mailto:${supportEmail}`}>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-100 text-xl text-brand-800" aria-hidden="true">✉</span>
          <h2 className="mt-5 text-xl font-semibold text-gray-900 group-hover:text-brand-700">Email support</h2>
          <p className="mt-2 break-all text-brand-700">{supportEmail}</p>
          <p className="mt-3 text-sm text-gray-500">For product questions, orders, returns, and general help.</p>
        </a>
        <a className="group rounded-2xl border border-gray-200 bg-white p-7 transition hover:border-brand-300 hover:shadow-lg" href={linkedinProfile} target="_blank" rel="noreferrer">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800" aria-hidden="true">in</span>
          <h2 className="mt-5 text-xl font-semibold text-gray-900 group-hover:text-brand-700">Connect on LinkedIn</h2>
          <p className="mt-2 text-brand-700">Mohil Kumar</p>
          <p className="mt-3 text-sm text-gray-500">Open the public profile in a new tab.</p>
        </a>
      </div>
      <p className="mt-8 text-sm text-gray-500">For order help, include your order number in your email. Do not send card numbers or passwords.</p>
    </main>
  );
}

export default Contact;
