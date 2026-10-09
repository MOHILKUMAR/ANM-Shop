import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api.js";
import AuthContext from "../context/AuthContext.js";
import { ListSkeleton } from "../components/Skeletons.jsx";
import { TicketSummary, TicketThread } from "../components/TicketThread.jsx";
import { OPEN_CHAT_EVENT, TICKETS_CHANGED_EVENT, ticketCategories } from "../data/tickets.js";
import { usePageMeta } from "../usePageMeta.js";

const inputClass = "w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const emptyForm = { subject: "", category: "order", orderCode: "", description: "" };

function Support() {
  const { user } = useContext(AuthContext);
  usePageMeta({ title: "Support", noindex: true });
  const [tickets, setTickets] = useState(null);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [openId, setOpenId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // Bumped when the chat assistant opens a ticket, to load the list again.
  const [ticketsVersion, setTicketsVersion] = useState(0);

  useEffect(() => {
    const reload = () => setTicketsVersion((version) => version + 1);
    window.addEventListener(TICKETS_CHANGED_EVENT, reload);
    return () => window.removeEventListener(TICKETS_CHANGED_EVENT, reload);
  }, []);

  useEffect(() => {
    if (!user?.token) return undefined;
    let active = true;
    Promise.all([
      apiRequest("/tickets/mine", { token: user.token }),
      apiRequest("/orders/myorders", { token: user.token }).catch(() => []),
    ])
      .then(([myTickets, myOrders]) => {
        if (!active) return;
        setTickets(myTickets);
        setOrders(Array.isArray(myOrders) ? myOrders : []);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      });
    return () => {
      active = false;
    };
  }, [user?.token, ticketsVersion]);

  if (!user) {
    return (
      <main className="mx-auto min-h-[60vh] max-w-3xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Sign in for support</h1>
        <p className="mt-3 text-gray-600">Sign in to ask about an order, a payment, or a refund.</p>
        <Link className="mt-6 inline-block font-semibold text-brand-700" to="/login" state={{ from: "/support" }}>Sign in</Link>
      </main>
    );
  }

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  async function submitTicket(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest("/tickets", {
        method: "POST",
        token: user.token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setTickets((current) => [result.ticket, ...(current || []).filter((ticket) => ticket._id !== result.ticket._id)]);
      setOpenId(result.ticket._id);
      setForm(emptyForm);
      setNotice(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function replyTo(ticketId, body) {
    const updated = await apiRequest(`/tickets/${ticketId}/messages`, {
      method: "POST",
      token: user.token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setTickets((current) => current.map((ticket) => (ticket._id === ticketId ? updated : ticket)));
  }

  return (
    <main className="mx-auto min-h-[60vh] max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-brand-700">Help centre</p>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Support</h1>
        <button className="gradient-action" type="button" onClick={() => window.dispatchEvent(new Event(OPEN_CHAT_EVENT))}>
          Chat with our assistant
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[22rem_1fr]">
        <form className="h-fit space-y-4 rounded-xl border border-gray-200 bg-white p-5" onSubmit={submitTicket}>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Open a ticket</h2>
            <p className="mt-1 text-sm text-gray-600">Our team replies here and by email.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="ticket-subject">Subject</label>
            <input id="ticket-subject" className={inputClass} required minLength={3} maxLength={150} placeholder="e.g. Refund not received" value={form.subject} onChange={update("subject")} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="ticket-category">Category</label>
            <select id="ticket-category" className={`${inputClass} bg-white`} value={form.category} onChange={update("category")}>
              {ticketCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="ticket-order">Related order (optional)</label>
            <select id="ticket-order" className={`${inputClass} bg-white`} value={form.orderCode} onChange={update("orderCode")}>
              <option value="">No specific order</option>
              {orders.map((order) => (
                <option key={order._id} value={order._id}>
                  #{order._id.slice(-8).toUpperCase()} · {new Date(order.createdAt).toLocaleDateString("en-IN")} · {Number(order.totalAmount).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="ticket-description">What happened?</label>
            <textarea id="ticket-description" className={inputClass} rows={5} required minLength={10} maxLength={4000} placeholder="Tell us what went wrong and what you'd like us to do." value={form.description} onChange={update("description")} />
          </div>
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
          {notice && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800" role="status">{notice}</p>}
          <button className="w-full rounded-lg bg-brand-700 px-4 py-2.5 font-semibold text-white hover:bg-brand-800 disabled:opacity-60" type="submit" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit ticket"}
          </button>
        </form>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Your tickets{tickets ? ` (${tickets.length})` : ""}</h2>
          {!tickets && !error && <ListSkeleton rows={3} label="Loading your tickets" />}
          {tickets && tickets.length === 0 && (
            <p className="rounded-xl bg-gray-50 p-6 text-gray-600">No tickets yet. Open one with the form, or ask the assistant.</p>
          )}
          {tickets?.map((ticket) => (
            <article className="rounded-xl border border-gray-200 bg-white p-5" key={ticket._id}>
              <button className="flex w-full items-start justify-between gap-3 text-left" type="button" aria-expanded={openId === ticket._id} onClick={() => setOpenId((current) => (current === ticket._id ? null : ticket._id))}>
                <TicketSummary ticket={ticket} />
                <span className="shrink-0 text-sm font-semibold text-brand-700">
                  {openId === ticket._id ? "Hide" : `View${ticket.messages.some((message) => message.author === "admin") ? " reply" : ""}`}
                </span>
              </button>
              {openId === ticket._id && <TicketThread ticket={ticket} viewer="customer" onReply={(body) => replyTo(ticket._id, body)} />}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

export default Support;
