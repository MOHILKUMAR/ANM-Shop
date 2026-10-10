import { supportEmail, businessInfo, grievanceInfo, showBusinessDetails, showGrievanceOfficer, withoutFinalStop } from "../data/contactInfo.js";
import { usePageMeta } from "../usePageMeta.js";
import { OPEN_CONSENT_EVENT } from "../consent.js";

const mail = <a className="font-medium text-brand-700 underline" href={`mailto:${supportEmail}`}>{supportEmail}</a>;

// Built on each render: the business and grievance officer details appear once they are filled
// in (data/contactInfo.js).
const sections = (business = businessInfo(), grievanceOfficer = grievanceInfo()) => [
  ["Who we are", <>ANM-Shop is an online beauty store for customers in India{showBusinessDetails() && <>, run by {business.legalName}, {withoutFinalStop(business.address)}</>}. This policy explains what personal information we collect when you use the store, why, who helps us process it, and the choices you have. Contact us about it at {mail}.</>],
  ["Information we collect", <>
    <strong>Account:</strong> your name, email address, and password (stored only as a one-way hash), plus short-lived verification codes and password-reset links, also stored as hashes.{" "}
    <strong>Orders:</strong> the products you buy, your delivery address and mobile number, the amount paid, any coupon used, and the Razorpay order and payment IDs.{" "}
    <strong>Reviews:</strong> your rating and review text, and whether you bought the product.{" "}
    <strong>Support:</strong> the tickets you open, the replies, and your conversations with the chat assistant.{" "}
    <strong>Technical data:</strong> your IP address and request details, used briefly to block abuse (for example, too many sign-in attempts) and to fix errors.
  </>],
  ["How we use it", <>To create and secure your account; to take payment, deliver orders, and send receipts, e-bills, and order updates; to answer support requests and email you replies; to show reviews; to apply coupons you are eligible for; and to protect the store from fraud and abuse. We do not sell your information or use it for third-party advertising.</>],
  ["What other customers see", <>Reviews are public and show your first name and the initial of your last name (for example, “Priya S.”), never your full name or email. A “Verified buyer” label appears when you have ordered the product.</>],
  ["The chat assistant", <>Messages you send to the chat assistant, and the order, payment, and ticket details it looks up for you, are sent to Google's Gemini API to write its replies. Under the terms of the free Gemini service we use, Google may use this content to improve its products, and it may be read by Google reviewers. Please do not share passwords, card numbers, or other sensitive information in the chat. Your chat history is kept until you press “New chat” or your account is deleted. You can always use a support ticket instead.</>],
  ["Payments", <>Payments are processed by Razorpay. Your card, UPI, net banking, or wallet details go directly to Razorpay; ANM-Shop never sees or stores them. We receive the payment ID, amount, method, and status so we can create your order or refund it.</>],
  ["Cookies and browser storage", <>ANM-Shop does not use advertising cookies. We keep a few items in your browser's local storage because the store needs them: your sign-in session, your cart (kept separately for each account on a shared device), your light or dark theme, and your privacy choice. With your consent, we also use Vercel Web Analytics and Speed Insights, which count page views and measure loading speed without cookies and without identifying you; they record the page, referring site, browser, device type, and country. You can change your choice at any time with <button className="font-medium text-brand-700 underline" type="button" onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}>Privacy choices</button>, also linked at the bottom of every page.</>],
  ["Who processes information for us", <>We use these providers only to run the store: Razorpay (payments), MongoDB Atlas (database), Render (our server), Vercel (website hosting and, with consent, analytics), Cloudinary (product images), Resend or Google Gmail (emails), and Google Gemini (the chat assistant). Each handles information under its own terms and privacy policy, and some may store it outside India.</>],
  ["How long we keep it", <>We keep your account until you delete it (Account settings → Delete account) or ask us to. When an account is deleted, its chat history and reviews are deleted too; orders, payment records, and support tickets are kept as business and tax records for as long as the law requires. Records of unpaid checkouts can be deleted after 24 hours.</>],
  ["Security", <>The store is served only over HTTPS. Passwords are hashed with bcrypt, sign-in sessions expire, changing your password signs you out everywhere else, and access to customer records is limited to authorised administrators. No online service can be completely secure, so please use a strong password that you don't use anywhere else.</>],
  ["Your rights", <>Under India's Digital Personal Data Protection Act, 2023 and other applicable law, you can ask to see the personal information we hold about you, to correct it, or to delete it, and you can withdraw consent you have given (such as for analytics). You can delete your account yourself in Account settings; for anything else, email {mail} from your account's address and we will respond within 30 days. If you are unhappy with our response, you may complain to the Data Protection Board of India.</>],
  showGrievanceOfficer() && ["Grievance officer", <>For a complaint about how we handle your personal information, or about an order or product, contact our grievance officer: {grievanceOfficer.name}, {grievanceOfficer.designation}, <a className="font-medium text-brand-700 underline" href={`mailto:${grievanceOfficer.email}`}>{grievanceOfficer.email}</a>{grievanceOfficer.phone && <>, {grievanceOfficer.phone}</>}. We acknowledge every complaint within {grievanceOfficer.acknowledgeWithin} and resolve it within {grievanceOfficer.resolveWithin}.</>],
  ["Children", <>ANM-Shop is intended for adults aged 18 and over. We do not knowingly collect information from children; if you believe a child has created an account, contact us and we will delete it.</>],
  ["Changes to this policy", <>If we change how we use your information, we will update this page and change the date at the top. For significant changes we will also tell you by email or on the site.</>],
];

function PrivacyPolicy() {
  usePageMeta({
    title: "Privacy policy",
    description: "How ANM-Shop collects, uses, stores, and protects your personal information, and the choices you have.",
  });
  return (
    <main className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">ANM-Shop policies</p>
      <h1 className="mt-3 text-4xl font-semibold text-gray-900">Privacy policy</h1>
      <p className="mt-3 text-sm text-gray-500">Last updated 10 October 2026.</p>
      <div className="mt-10 space-y-8 text-gray-700">
        {sections().filter(Boolean).map(([heading, body]) => (
          <section key={heading}>
            <h2 className="text-xl font-semibold text-gray-900">{heading}</h2>
            <p className="mt-2 leading-7">{body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}

export default PrivacyPolicy;
