import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Contact from "./Contact.jsx";
import Terms from "./Terms.jsx";
import PrivacyPolicy from "./PrivacyPolicy.jsx";
import Footer from "../components/Footer.jsx";
import { business, grievanceOfficer } from "../data/contactInfo.js";

// Sample details for these tests only. The real ones go in data/contactInfo.js, which ships
// empty so that nothing made up appears on the live shop.
const sampleBusiness = { legalName: "Example Beauty Traders", address: "12 Sample Road, Delhi, Delhi 110001", phone: "+91 90000 00000", gstin: "GSTIN-SAMPLE-0001" };
const sampleOfficer = { name: "Asha Example", designation: "Proprietor", email: "grievance@example.com", phone: "+91 90000 00001" };

const original = { business: { ...business }, grievanceOfficer: { ...grievanceOfficer } };
afterEach(() => {
  cleanup();
  Object.assign(business, original.business);
  Object.assign(grievanceOfficer, original.grievanceOfficer);
});

const show = (page) => render(<MemoryRouter>{page}</MemoryRouter>);
const sectionOf = (heading) => screen.getByRole("heading", { name: heading }).closest("section");

test("the shop ships with no business or grievance details filled in", () => {
  expect(business).toMatchObject({ legalName: "", address: "", phone: "", gstin: "" });
  expect(grievanceOfficer).toMatchObject({ name: "", designation: "", email: "", phone: "" });
});

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
  Object.assign(business, { legalName: sampleBusiness.legalName }); // no address yet
  Object.assign(grievanceOfficer, { name: sampleOfficer.name }); // no email yet
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
  const whoWeAre = sectionOf("Who we are");
  expect(whoWeAre.textContent).toContain("ANM-Shop is run by Example Beauty Traders, 12 Sample Road, Delhi, Delhi 110001 (GSTIN GSTIN-SAMPLE-0001).");
  expect(within(sectionOf("Contact")).getByRole("link", { name: sampleOfficer.email })).toBeTruthy();
  cleanup();

  show(<PrivacyPolicy />);
  expect(sectionOf("Who we are").textContent).toContain("customers in India, run by Example Beauty Traders, 12 Sample Road");
  const complaints = sectionOf("Grievance officer");
  expect(complaints.textContent).toContain("Asha Example, Proprietor");
  expect(complaints.textContent).toContain("within 48 hours and resolve it within one month");
  expect(within(complaints).getByRole("link", { name: sampleOfficer.email })).toBeTruthy();
});
