import { afterEach, expect, test, vi } from "vitest";
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import AdminSearch from "./AdminSearch.jsx";
import { apiRequest } from "../api.js";

vi.mock("../api.js", () => ({ apiRequest: vi.fn() }));
configure({ asyncUtilTimeout: 5000 });
afterEach(cleanup);

const checkout = (id, paymentId) => ({
  _id: id,
  razorpayOrderId: `order_${id}`,
  paymentId,
  status: "pending",
  amountPaise: 24900,
  user: { _id: "u1", name: "Priya", email: "priya@example.com" },
  createdAt: "2026-10-10T10:00:00.000Z",
});

test("a pending checkout with a payment ID shows as paid but being confirmed", async () => {
  apiRequest.mockResolvedValue({
    query: "priya@example.com",
    orders: [],
    payments: [checkout("64b0aa000000000000000001", "pay_confirming1"), checkout("64b0aa000000000000000002", undefined)],
    customers: [],
  });
  render(<AdminSearch token="test" />);
  fireEvent.change(screen.getByLabelText("Search orders, payments, and customers"), { target: { value: "priya@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));

  await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(2));
  const [confirming, abandoned] = screen.getAllByRole("article");
  expect(within(confirming).getByText("Paid, being confirmed")).toBeTruthy();
  expect(within(abandoned).getByText("Awaiting payment")).toBeTruthy();
});

test("a customer's payment history shows the same labels", async () => {
  apiRequest.mockResolvedValue({
    query: "priya@example.com",
    orders: [],
    payments: [],
    customers: [{
      user: { _id: "u1", name: "Priya", email: "priya@example.com", role: "user", verified: true },
      orderCount: 0,
      totalSpent: 0,
      orders: [],
      payments: [checkout("64b0aa000000000000000003", "pay_confirming2")],
    }],
  });
  render(<AdminSearch token="test" />);
  fireEvent.change(screen.getByLabelText("Search orders, payments, and customers"), { target: { value: "priya@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));

  await waitFor(() => expect(screen.getByText("Payment history")).toBeTruthy());
  const history = screen.getByText("Payment history").nextElementSibling;
  expect(within(history).getByText("Paid, being confirmed")).toBeTruthy();
});
