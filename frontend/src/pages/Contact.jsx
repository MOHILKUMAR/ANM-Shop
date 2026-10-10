import { supportEmail, linkedinProfile, business, grievanceOfficer, showBusinessDetails, showGrievanceOfficer } from "../data/contactInfo.js";
import { usePageMeta } from "../usePageMeta.js";

const linkClass = "font-medium text-brand-700 underline";
const telHref = (phone) => `tel:${phone.replace(/[^\d+]/g, "")}`;

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-0.5 break-words text-gray-900">{children}</dd>
    </div>
  );
}

function Contact() {
  const showBusiness = showBusinessDetails();
  const showGrievance = showGrievanceOfficer();
  usePageMeta({
    title: "Contact us",
    description: "Questions about a product, an order, or a return? Email ANM-Shop support or open a ticket and we'll get back to you.",
  });
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
      {(showBusiness || showGrievance) && (
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {showBusiness && (
            <section className="rounded-2xl border border-gray-200 bg-white p-7" aria-labelledby="business-details">
              <h2 id="business-details" className="text-xl font-semibold text-gray-900">Business details</h2>
              <dl className="mt-4 space-y-3">
                <Detail label="Legal name">{business.legalName}</Detail>
                <Detail label="Registered address">{business.address}</Detail>
                {business.phone.trim() && <Detail label="Phone"><a className={linkClass} href={telHref(business.phone)}>{business.phone}</a></Detail>}
                <Detail label="Email"><a className={`${linkClass} break-all`} href={`mailto:${supportEmail}`}>{supportEmail}</a></Detail>
                {business.gstin.trim() && <Detail label="GSTIN">{business.gstin}</Detail>}
              </dl>
            </section>
          )}
          {showGrievance && (
            <section className="rounded-2xl border border-gray-200 bg-white p-7" aria-labelledby="grievance-officer">
              <h2 id="grievance-officer" className="text-xl font-semibold text-gray-900">Grievance officer</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                For a complaint about an order, a product, or how we handle your personal information. We acknowledge every complaint within {grievanceOfficer.acknowledgeWithin} and resolve it within {grievanceOfficer.resolveWithin}.
              </p>
              <dl className="mt-4 space-y-3">
                <Detail label="Name">{grievanceOfficer.name}{grievanceOfficer.designation.trim() && `, ${grievanceOfficer.designation}`}</Detail>
                <Detail label="Email"><a className={`${linkClass} break-all`} href={`mailto:${grievanceOfficer.email}`}>{grievanceOfficer.email}</a></Detail>
                {grievanceOfficer.phone.trim() && <Detail label="Phone"><a className={linkClass} href={telHref(grievanceOfficer.phone)}>{grievanceOfficer.phone}</a></Detail>}
              </dl>
            </section>
          )}
        </div>
      )}
      <p className="mt-8 text-sm text-gray-500">For order help, include your order number in your email. Do not send card numbers or passwords.</p>
    </main>
  );
}

export default Contact;
