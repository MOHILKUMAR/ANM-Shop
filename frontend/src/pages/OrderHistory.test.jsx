import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import OrderHistory from "./OrderHistory.jsx";
import AuthContext from "../context/AuthContext.js";
import { apiRequest } from "../api.js";
import { business } from "../data/contactInfo.js";

vi.mock("../api.js", () => ({ apiRequest: vi.fn() }));

// A stand-in for jsPDF that records what each bill writes, page by page (A4: 210 x 297 mm).
const pdfs = vi.hoisted(() => []);
vi.mock("jspdf", () => ({
  jsPDF: class {
    constructor() {
      this.pages = [[]];
      this.internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 }, scaleFactor: 72 / 25.4 };
      this.fontSize = 16;
      pdfs.push(this);
    }
    text(text, x, y) { this.pages.at(-1).push({ text: [].concat(text).join("\n"), y }); }
    splitTextToSize(text) { return [String(text)]; }
    addPage() { this.pages.push([]); }
    save(name) { this.saved = name; }
    setFillColor() {}
    rect() {}
    roundedRect() {}
    setTextColor() {}
    setFont() {}
    setFontSize(size) { this.fontSize = size; }
    getLineHeight() { return this.fontSize * 1.15; } // in points, like jsPDF's default line height
    setDrawColor() {}
    line() {}
  },
}));

configure({ asyncUtilTimeout: 5000 });
const original = { ...business };
beforeEach(() => {
  pdfs.length = 0;
  Object.assign(business, { legalName: "", address: "", phone: "", gstin: "" });
});
afterEach(() => {
  cleanup();
  Object.assign(business, original);
});

// An order with `count` items and one of three endings: "full" (subtotal, shipping, a coupon
// discount and a refund: the longest), "plain" (subtotal and shipping) or "old" (a total only,
// as orders placed before shipping and coupons existed).
let orderNumber = 0;
const order = (count, ending = "full") => ({
  _id: `64b0aa00000000000000${String((orderNumber += 1)).padStart(4, "0")}`,
  createdAt: "2026-10-10T10:00:00.000Z",
  paymentId: `pay_${orderNumber}`,
  status: ending === "full" ? "cancelled" : "delivered",
  items: Array.from({ length: count }, (_, index) => ({ productId: { _id: `p${index}`, name: `Product ${index + 1}` }, qty: 1, price: 100 })),
  ...(ending !== "old" && { subtotalAmount: count * 100, shippingFee: 49 }),
  ...(ending === "full" && {
    discountAmount: 10,
    couponCode: "SAVE10",
    refund: { status: "refunded", amount: count * 100 + 39, completedAt: "2026-10-11T10:00:00.000Z" },
  }),
  totalAmount: count * 100 + 39,
  address: { fullName: "Priya Sharma", street: "12 MG Road", city: "Delhi", postalCode: "110001", country: "India", phone: "+91 98765 43210" },
});

const showOrders = async (orders) => {
  apiRequest.mockResolvedValue(orders);
  render(
    <MemoryRouter>
      <AuthContext.Provider value={{ user: { token: "test" } }}>
        <OrderHistory />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
  return screen.findAllByRole("button", { name: "Download bill (PDF)" });
};

const downloadBill = async (button) => {
  const before = pdfs.length;
  fireEvent.click(button);
  await waitFor(() => expect(pdfs[before]?.saved).toBeTruthy());
  return pdfs[before];
};
const find = (pdf, text) => pdf.pages.flatMap((page, index) => page.map((entry) => ({ ...entry, page: index }))).find((entry) => entry.text.includes(text));

test("the PDF bill names no seller while the business details are empty", async () => {
  const [button] = await showOrders([order(2)]);
  const pdf = await downloadBill(button);
  expect(find(pdf, "Sold by")).toBeUndefined();
});

test("once filled in, the PDF bill names the seller above the delivery address", async () => {
  Object.assign(business, { legalName: " Example Beauty Traders ", address: "12 Sample Road, Delhi, Delhi 110001", phone: "+91 90000 00000", gstin: "GSTIN-SAMPLE-0001" });
  const [button] = await showOrders([order(2)]);
  const pdf = await downloadBill(button);

  const soldBy = find(pdf, "Sold by");
  const seller = find(pdf, "Example Beauty Traders");
  expect(seller.text).toBe("Example Beauty Traders\n12 Sample Road, Delhi, Delhi 110001\nGSTIN: GSTIN-SAMPLE-0001    Phone: +91 90000 00000");
  expect(seller.y).toBeGreaterThan(soldBy.y);
  // Three 9 pt lines (1.15 x 9 pt apart, as jsPDF draws them), then the usual 10 mm to the next heading.
  const lineHeight = (9 * 1.15) / (72 / 25.4);
  expect(find(pdf, "Delivery address").y).toBeCloseTo(seller.y + 2 * lineHeight + 10, 5);
});

test("the totals, any refund and the closing line of a long bill stay together above the bottom margin", async () => {
  const bills = ["full", "plain", "old"].flatMap((ending) => Array.from({ length: 30 }, (_, index) => ({ count: index + 1, ending })));
  const buttons = await showOrders(bills.map(({ count, ending }) => order(count, ending)));
  for (const [index, button] of buttons.entries()) {
    const pdf = await downloadBill(button);
    const label = `${bills[index].count} items, ${bills[index].ending} ending`;
    const closing = find(pdf, "Thank you for shopping with ANM-Shop.");
    const ending = [find(pdf, "TOTAL PAID"), find(pdf, "REFUNDED"), find(pdf, "Subtotal")].filter(Boolean);
    expect(ending.length, label).toBe({ full: 3, plain: 2, old: 1 }[bills[index].ending]);
    expect(closing.y, label).toBeLessThanOrEqual(297 - 15);
    for (const line of ending) expect(line.page, label).toBe(closing.page);
  }
});
