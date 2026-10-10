export const supportEmail = "mohil4280@gmail.com";
export const linkedinProfile = "https://www.linkedin.com/in/mohil-kumar-dev";

// The business behind the shop. Customers, Razorpay and India's e-commerce rules expect these
// details on the site. Nothing shows until legalName and address are filled in; then they
// appear on the Contact page, in the footer, in the Terms, in the Privacy policy and on the PDF
// bill. Put the same values in backend/config/business.js for the e-bill email (a test fails
// while the two differ). Leave a field "" until you have the real value, and when you fill them
// in, update "Last updated" on the Terms and Privacy pages.
export const business = {
  legalName: "", // the registered business name, or the proprietor's name
  address: "", // registered address on one line: street, city, state, PIN
  phone: "", // a number customers can call
  gstin: "", // leave "" if not registered for GST
};

// The person customers can complain to. The Consumer Protection (E-Commerce) Rules, 2020 ask
// for their name, designation and contact details; the Digital Personal Data Protection Act,
// 2023 also expects a contact for privacy complaints. Shown on the Contact page, in the Terms
// and in the Privacy policy once name, designation and email are filled in.
export const grievanceOfficer = {
  name: "",
  designation: "", // e.g. "Proprietor"
  email: "",
  phone: "",
  acknowledgeWithin: "48 hours",
  resolveWithin: "one month",
};

const trimmed = (details) => Object.fromEntries(Object.entries(details).map(([key, value]) => [key, String(value ?? "").trim()]));

// The values as the pages show them: trimmed, and read at render time.
export const businessInfo = () => trimmed(business);
export const grievanceInfo = () => trimmed(grievanceOfficer);

export const showBusinessDetails = () => {
  const { legalName, address } = businessInfo();
  return Boolean(legalName && address);
};
export const showGrievanceOfficer = () => {
  const { name, designation, email } = grievanceInfo();
  return Boolean(name && designation && email);
};

// For a value that ends a sentence the page closes itself ("Pvt. Ltd." + "." would read "..").
export const withoutFinalStop = (text) => text.replace(/\.+$/, "");
