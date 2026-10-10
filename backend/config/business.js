// The business behind the shop, for the e-bill email. Keep these the same as `business` in
// frontend/src/data/contactInfo.js (the site and the PDF bill read that file); a test fails
// when the two differ. Nothing shows on the e-bill until legalName and address are filled in.
// Use Latin letters only: the PDF bill's font can't draw ₹, № or Hindi (a test checks).
const business = {
    legalName: '', // the registered business name, or the proprietor's name
    address: '', // registered address on one line: street, city, state, PIN
    phone: '', // a number customers can call
    gstin: '', // leave '' if not registered for GST
};

// The seller as the e-bill shows it (trimmed), or null until the details are filled in.
const seller = () => {
    const details = Object.fromEntries(Object.entries(business).map(([key, value]) => [key, String(value ?? '').trim()]));
    return details.legalName && details.address ? details : null;
};

module.exports = { business, seller };
