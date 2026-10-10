export const supportEmail = "mohil4280@gmail.com";
export const linkedinProfile = "https://www.linkedin.com/in/mohil-kumar-dev";

// The business behind the shop. Customers, Razorpay and India's e-commerce rules expect these
// details on the site. Nothing shows until legalName and address are filled in; then they
// appear on the Contact page, in the footer and in the Terms. Leave a field "" until you have
// the real value, and when you fill them in, update "Last updated" on the Terms and Privacy pages.
export const business = {
  legalName: "", // the registered business name, or the proprietor's name
  address: "", // registered address on one line: street, city, state, PIN
  phone: "", // a number customers can call
  gstin: "", // leave "" if not registered for GST
};

// The person customers can complain to (Consumer Protection (E-Commerce) Rules, 2020, and the
// Digital Personal Data Protection Act, 2023). Shown on the Contact page and in the Privacy
// policy once name and email are filled in.
export const grievanceOfficer = {
  name: "",
  designation: "", // e.g. "Proprietor"
  email: "",
  phone: "",
  acknowledgeWithin: "48 hours",
  resolveWithin: "one month",
};

export const showBusinessDetails = () => Boolean(business.legalName.trim() && business.address.trim());
export const showGrievanceOfficer = () => Boolean(grievanceOfficer.name.trim() && grievanceOfficer.email.trim());
