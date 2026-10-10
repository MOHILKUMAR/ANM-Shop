import { afterEach, beforeEach, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Contact from "./Contact.jsx";
import Terms from "./Terms.jsx";
import PrivacyPolicy from "./PrivacyPolicy.jsx";
import Footer from "../components/Footer.jsx";
import { business, grievanceOfficer, supportEmail } from "../data/contactInfo.js";

// Sample details for these tests only; the real ones go in data/contactInfo.js. Every test
// starts from empty details, so the tests pass whatever that file holds.
const sampleBusiness = { legalName: "Example Beauty Traders", address: "12 Sample Road, Delhi, Delhi 110001", phone: "+91 90000 00000", gstin: "GSTIN-SAMPLE-0001" };
const sampleOfficer = { name: "Asha Example", designation: "Proprietor", email: "grievance@example.com", phone: "+91 90000 00001", acknowledgeWithin: "48 hours", resolveWithin: "one month" };

const original = { business: { ...business }, grievanceOfficer: { ...grievanceOfficer } };
beforeEach(() => {
  Object.assign(business, { legalName: "", address: "", phone: "", gstin: "" });
  Object.assign(grievanceOfficer, { name: "", designation: "", email: "", phone: "" });
});
afterEach(() => {
  cleanup();
  Object.assign(business, original.business);
  Object.assign(grievanceOfficer, original.grievanceOfficer);
});

const show = (page) => render(<MemoryRouter>{page}</MemoryRouter>);
const sectionOf = (heading) => screen.getByRole("heading", { name: heading }).closest("section");

test("while the details are empty, none of the new sections appear", () => {
  show(<Contact />);
  expect(screen.queryByRole("heading", { name: "Business details" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Grievance officer" })).toBeNull();
  cleanup();

  show(<Terms />);
  expect(screen.queryByRole("heading", { name: "Who we are" })).toBeNull();
  expect(screen.queryByText(/grievance officer/i)).toBeNull();
  cleanup();

  show(<PrivacyPolicy />);
  expect(screen.queryByRole("heading", { name: "Grievance officer" })).toBeNull();
  expect(screen.queryByText(/run by/)).toBeNull();
  cleanup();

  show(<Footer />);
  expect(screen.getByText(/ANM-Shop\. All rights reserved\./)).toBeTruthy();
});

test("half-filled details stay hidden", () => {
  Object.assign(business, { legalName: sampleBusiness.legalName, address: "   " }); // no address yet
  Object.assign(grievanceOfficer, { name: sampleOfficer.name, email: sampleOfficer.email }); // no designation yet
  show(<Contact />);
  expect(screen.queryByRole("heading", { name: "Business details" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Grievance officer" })).toBeNull();
  expect(screen.queryByText(sampleBusiness.legalName)).toBeNull();
});

test("once filled in, the Contact page shows the business and the grievance officer", () => {
  Object.assign(business, sampleBusiness);
  Object.assign(grievanceOfficer, sampleOfficer);
  show(<Contact />);

  const details = within(screen.getByRole("region", { name: "Business details" }));
  expect(details.getByText(sampleBusiness.legalName)).toBeTruthy();
  expect(details.getByText(sampleBusiness.address)).toBeTruthy();
  expect(details.getByText(sampleBusiness.gstin)).toBeTruthy();
  expect(details.getByRole("link", { name: sampleBusiness.phone }).getAttribute("href")).toBe("tel:+919000000000");

  const officer = within(screen.getByRole("region", { name: "Grievance officer" }));
  expect(officer.getByText("Asha Example, Proprietor")).toBeTruthy();
  expect(officer.getByRole("link", { name: sampleOfficer.email }).getAttribute("href")).toBe("mailto:grievance@example.com");
  expect(officer.getByRole("link", { name: sampleOfficer.phone }).getAttribute("href")).toBe("tel:+919000000001");
  expect(officer.getByText(/within 48 hours and resolve it within one month/)).toBeTruthy();
});

test("once filled in, the footer, Terms and Privacy policy name the business and the officer", () => {
  Object.assign(business, sampleBusiness);
  Object.assign(grievanceOfficer, sampleOfficer);

  show(<Footer />);
  expect(screen.getByText(/ANM-Shop, run by Example Beauty Traders\. All rights reserved\./)).toBeTruthy();
  expect(screen.getByRole("link", { name: sampleBusiness.phone })).toBeTruthy();
  cleanup();

  show(<Terms />);
  expect(sectionOf("Who we are").textContent).toContain("ANM-Shop is run by Example Beauty Traders, 12 Sample Road, Delhi, Delhi 110001 (GSTIN GSTIN-SAMPLE-0001).");
  expect(within(sectionOf("Contact")).getByRole("link", { name: sampleOfficer.email })).toBeTruthy();
  cleanup();

  show(<PrivacyPolicy />);
  expect(sectionOf("Who we are").textContent).toContain("customers in India, run by Example Beauty Traders, 12 Sample Road");
  const complaints = sectionOf("Grievance officer");
  expect(complaints.textContent).toContain("contact our grievance officer: Asha Example, Proprietor, grievance@example.com, +91 90000 00001.");
  expect(complaints.textContent).toContain("within 48 hours and resolve it within one month");
});

test("optional fields left empty leave no gaps", () => {
  Object.assign(business, { ...sampleBusiness, phone: "", gstin: "" });
  Object.assign(grievanceOfficer, { ...sampleOfficer, phone: "" });

  show(<Contact />);
  expect(screen.queryByText("GSTIN")).toBeNull();
  expect(screen.queryByText("Phone")).toBeNull();
  cleanup();

  show(<Terms />);
  expect(sectionOf("Who we are").querySelector("p").textContent).toBe(`ANM-Shop is run by Example Beauty Traders, 12 Sample Road, Delhi, Delhi 110001. You can reach us at ${supportEmail}.`);
  cleanup();

  show(<PrivacyPolicy />);
  expect(sectionOf("Grievance officer").textContent).toContain("Asha Example, Proprietor, grievance@example.com. We acknowledge");
});

test("stray spaces are trimmed, and a name ending in a full stop doesn't get a second one", () => {
  Object.assign(business, { legalName: "  ABC Traders Pvt. Ltd. ", address: " 12 Sample Road, Delhi 110001. ", phone: "", gstin: "" });
  Object.assign(grievanceOfficer, { ...sampleOfficer, email: " grievance@example.com " });

  show(<Footer />);
  expect(screen.getByText(/ANM-Shop, run by ABC Traders Pvt\. Ltd\. All rights reserved\./)).toBeTruthy();
  cleanup();

  show(<Terms />);
  expect(sectionOf("Who we are").textContent).toContain("ANM-Shop is run by ABC Traders Pvt. Ltd., 12 Sample Road, Delhi 110001. You can");
  cleanup();

  show(<PrivacyPolicy />);
  expect(sectionOf("Who we are").textContent).toContain("run by ABC Traders Pvt. Ltd., 12 Sample Road, Delhi 110001. This policy");
  expect(within(sectionOf("Grievance officer")).getByRole("link", { name: "grievance@example.com" }).getAttribute("href")).toBe("mailto:grievance@example.com");
});
