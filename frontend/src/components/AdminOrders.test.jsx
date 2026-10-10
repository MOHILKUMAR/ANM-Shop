import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminOrders from "./AdminOrders.jsx";
import { apiRequest } from "../api.js";

vi.mock("../api.js", () => ({ apiRequest: vi.fn() }));
configure({ asyncUtilTimeout: 5000 });

// A small stand-in for the admin orders API: 20 orders a page, newest first, and cancelling
// refunds the order.
const PAGE_SIZE = 20;
const STATUSES = ["pending", "shipped", "delivered", "cancelled", "returned"];
let orders;
// When set, requests for that page wait for the promise (to look at the screen while it loads).
let holdPage;
let holdLists;

function makeOrders(count) {
  orders = Array.from({ length: count }, (_, index) => ({
    _id: `64b0aa00000000000000${String(index + 1).padStart(4, "0")}`,
    user: { name: "Priya", email: "priya@example.com" },
    items: [{ productId: { name: `Item ${index + 1}` }, qty: 1 }],
    totalAmount: 249,
    status: "pending",
    createdAt: new Date(Date.UTC(2026, 9, 10) - index * 60_000).toISOString(),
  }));
}

async function fakeApi(path, { method = "GET" } = {}) {
  const url = new URL(path, "http://test");
  if (method === "GET" && url.pathname === "/orders") {
    const status = url.searchParams.get("status");
    const page = Number(url.searchParams.get("page")) || 1;
    if (holdLists && page === holdPage) await holdLists;
    const matching = orders.filter((order) => !status || order.status === status);
    // Copies, like a real response: later changes on the "server" don't reach what is on screen.
    return {
      orders: structuredClone(matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)),
      counts: Object.fromEntries(STATUSES.map((value) => [value, orders.filter((order) => order.status === value).length])),
      refundProblems: 0,
      pagination: { page, limit: PAGE_SIZE, total: matching.length, pages: Math.ceil(matching.length / PAGE_SIZE) },
    };
  }
  const [, id, action] = url.pathname.match(/^\/orders\/(\w+)\/(cancel|refund)$/) || [];
  const order = orders.find((item) => item._id === id);
  if (action === "refund") {
    throw Object.assign(new Error("The refund failed again: Razorpay refused it. Refund it in the Razorpay dashboard, then press Retry to record it."), { status: 502 });
  }
  order.status = "cancelled";
  order.refund = { status: "refunded", amount: order.totalAmount };
  return { message: "Order cancelled.", order: structuredClone(order) };
}

beforeEach(() => {
  holdPage = null;
  holdLists = null;
  apiRequest.mockImplementation(fakeApi);
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const pager = () => screen.queryByText(/^Page \d+ of \d+$/)?.textContent ?? "no pages";

test("emptying the last page shows the loading placeholder, not the old orders, until the new page arrives", async () => {
  makeOrders(21);
  render(<AdminOrders token="test" />);
  await waitFor(() => expect(screen.getByRole("button", { name: /^pending \(21\)$/ })).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: /^pending \(21\)$/ }));
  await waitFor(() => expect(pager()).toBe("Page 1 of 2"));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(pager()).toBe("Page 2 of 2"));
  expect(screen.getAllByRole("button", { name: "Cancel & refund" })).toHaveLength(1);

  // Cancel the only order on page 2, holding the load of page 1 (the page that is now last).
  let sendLists;
  holdPage = 1;
  holdLists = new Promise((resolve) => { sendLists = resolve; });
  const callsBefore = apiRequest.mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Cancel & refund" }));
  await waitFor(() => expect(apiRequest.mock.calls.slice(callsBefore).some(([path]) => path === "/orders?page=1&status=pending")).toBe(true));
  await new Promise((resolve) => { setTimeout(resolve, 50); });
  expect(screen.getByText("Loading orders")).toBeTruthy();
  expect(screen.queryByText(/Item 21/)).toBeNull(); // the cancelled order's old row is gone
  expect(screen.queryAllByRole("button", { name: "Cancel & refund" })).toHaveLength(0);

  sendLists();
  await waitFor(() => expect(screen.getAllByRole("button", { name: "Cancel & refund" })).toHaveLength(20));
  expect(pager()).toBe("no pages");
});

test("a failed refund retry keeps its instructions on screen after the list reloads", async () => {
  makeOrders(2);
  orders[0].status = "cancelled";
  orders[0].refund = { status: "failed", amount: 249, error: "Razorpay refused it", requestedAt: "2026-10-10T00:00:00.000Z" };
  render(<AdminOrders token="test" />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Retry refund" })).toBeTruthy());

  const callsBefore = apiRequest.mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Retry refund" }));
  await waitFor(() => expect(apiRequest.mock.calls.length).toBeGreaterThan(callsBefore + 1)); // the retry and the reload
  await waitFor(() => expect(screen.queryByText("Loading orders")).toBeNull());
  expect(screen.getByRole("alert").textContent).toMatch(/then press Retry to record it/);
});

test("moving to another page clears a message about an order on this one", async () => {
  makeOrders(25);
  orders[0].status = "cancelled";
  orders[0].refund = { status: "failed", amount: 249, error: "Razorpay refused it", requestedAt: "2026-10-10T00:00:00.000Z" };
  render(<AdminOrders token="test" />);
  await waitFor(() => expect(pager()).toBe("Page 1 of 2"));

  fireEvent.click(screen.getByRole("button", { name: "Retry refund" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/refund failed again/));
  await waitFor(() => expect(screen.queryByText("Loading orders")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(pager()).toBe("Page 2 of 2"));
  expect(screen.queryByRole("alert")).toBeNull();
});
