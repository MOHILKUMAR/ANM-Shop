import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import AdminTickets from "./AdminTickets.jsx";
import { apiRequest } from "../api.js";

vi.mock("../api.js", () => ({ apiRequest: vi.fn() }));
// Rendering 50 tickets in the simulated browser can take over a second on a cold start.
configure({ asyncUtilTimeout: 5000 });

// A small stand-in for the ticket API with the server's rules: 50 tickets a page, newest activity
// first, and an admin reply turns an open ticket "in progress" and moves it to the top.
const PAGE_SIZE = 50;
const STATUSES = ["open", "in_progress", "resolved", "closed"];
const ORDER = { _id: "order1", code: "#ORDER001", totalAmount: 999, status: "delivered", paymentId: "pay_test1", createdAt: "2026-10-01T10:00:00.000Z" };
let tickets;
let clock;
let holdReplies;

function makeTickets(count, status = "open") {
  clock = Date.UTC(2026, 9, 10, 12);
  tickets = Array.from({ length: count }, (_, index) => ({
    _id: `t${index + 1}`,
    code: `#T${index + 1}`,
    subject: `Question ${index + 1}`,
    category: "order",
    description: `Ticket number ${index + 1}.`,
    status,
    source: "customer",
    order: ORDER,
    messages: [],
    user: { _id: "u1", name: "Priya", email: "priya@example.com" },
    createdAt: new Date(clock - index * 60_000).toISOString(),
    lastActivityAt: clock - index * 60_000,
  }));
}

const asJson = (ticket) => ({ ...ticket, lastActivityAt: new Date(ticket.lastActivityAt).toISOString() });

async function fakeApi(path, { method = "GET", body } = {}) {
  const url = new URL(path, "http://test");
  if (method === "GET" && url.pathname === "/tickets") {
    const status = url.searchParams.get("status");
    const page = Number(url.searchParams.get("page")) || 1;
    const matching = tickets.filter((ticket) => !status || ticket.status === status).sort((a, b) => b.lastActivityAt - a.lastActivityAt);
    const counts = Object.fromEntries(STATUSES.map((value) => [value, tickets.filter((ticket) => ticket.status === value).length]));
    return {
      tickets: matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(asJson),
      counts,
      pagination: { page, pages: Math.ceil(matching.length / PAGE_SIZE), total: matching.length },
    };
  }
  const [, id, action] = url.pathname.match(/^\/tickets\/(\w+)\/(messages|status)$/) || [];
  const ticket = tickets.find((item) => item._id === id);
  if (action === "messages") {
    if (holdReplies) await holdReplies;
    ticket.messages.push({ author: "admin", authorName: "Asha", body: JSON.parse(body).body, createdAt: new Date(clock).toISOString() });
    if (ticket.status === "open") ticket.status = "in_progress";
  } else {
    ticket.status = JSON.parse(body).status;
  }
  clock += 60_000;
  ticket.lastActivityAt = clock;
  return asJson(ticket);
}

beforeEach(() => {
  holdReplies = null;
  apiRequest.mockImplementation(fakeApi);
});
afterEach(cleanup);

const statusSelects = () => screen.queryAllByRole("combobox", { name: "Ticket status" });
const ticketCard = (subject) => screen.getByText(subject).closest("article");
const chip = (label) => screen.getByRole("button", { name: new RegExp(`^${label} \\(`) });
const pager = () => screen.queryByText(/^Page \d+ of \d+$/)?.textContent ?? "no pages";

async function reply(subject, text) {
  const card = ticketCard(subject);
  if (!within(card).queryByRole("textbox")) fireEvent.click(within(card).getByRole("button", { name: "Open" }));
  fireEvent.change(within(card).getByRole("textbox"), { target: { value: text } });
  fireEvent.click(within(card).getByRole("button", { name: "Send reply" }));
}

test("answering a ticket on the Open view refills the page from the next one", async () => {
  makeTickets(60);
  render(<AdminTickets token="test" />);
  await waitFor(() => expect(statusSelects()).toHaveLength(50));
  expect(pager()).toBe("Page 1 of 2");

  await reply("Question 1", "We are looking into it.");
  await waitFor(() => expect(chip("Open").textContent).toBe("Open (59)"));
  expect(screen.queryByText("Question 1")).toBeNull();
  expect(statusSelects()).toHaveLength(50);
  expect(screen.getByText("Question 51")).toBeTruthy();
  expect(pager()).toBe("Page 1 of 2");
});

test("a reply on page 2 follows the ticket to the top of page 1, thread and order summary still shown", async () => {
  makeTickets(55, "in_progress");
  render(<AdminTickets token="test" />);
  await waitFor(() => expect(screen.getByText(/No tickets here/)).toBeTruthy());
  fireEvent.click(chip("All"));
  await waitFor(() => expect(pager()).toBe("Page 1 of 2"));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(pager()).toBe("Page 2 of 2"));

  await reply("Question 53", "Your parcel left the warehouse today.");
  await waitFor(() => expect(pager()).toBe("Page 1 of 2"));
  await waitFor(() => expect(within(statusSelects()[0].closest("article")).getByText("Question 53")).toBeTruthy());
  const card = ticketCard("Question 53");
  expect(within(card).getByText("Your parcel left the warehouse today.")).toBeTruthy();
  expect(within(card).getByRole("textbox")).toBeTruthy();
  expect(within(card).getByText(/Order #ORDER001: ₹999/)).toBeTruthy();
});

test("resolving the last tickets on the last page goes back to the page before", async () => {
  makeTickets(53);
  render(<AdminTickets token="test" />);
  await waitFor(() => expect(pager()).toBe("Page 1 of 2"));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(statusSelects()).toHaveLength(3));

  for (let left = 3; left > 0; left -= 1) {
    fireEvent.change(statusSelects()[0], { target: { value: "resolved" } });
    await waitFor(() => expect(chip("Open").textContent).toBe(`Open (${50 + left - 1})`));
  }
  await waitFor(() => expect(statusSelects()).toHaveLength(50));
  expect(pager()).toBe("no pages");
  expect(screen.queryByText(/No tickets here/)).toBeNull();
});

test("switching filter while a reply is being saved keeps the page working", async () => {
  makeTickets(5);
  let release;
  holdReplies = new Promise((resolve) => { release = resolve; });
  render(<AdminTickets token="test" />);
  await waitFor(() => expect(statusSelects()).toHaveLength(5));

  await reply("Question 2", "Checking now.");
  fireEvent.click(chip("All"));
  release();
  await waitFor(() => expect(chip("In progress").textContent).toBe("In progress (1)"));
  await waitFor(() => expect(statusSelects()).toHaveLength(5));
  expect(screen.getByRole("button", { name: /^All \(/, pressed: true })).toBeTruthy();
});
