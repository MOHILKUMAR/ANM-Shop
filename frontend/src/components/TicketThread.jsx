import { useState } from "react";
import { categoryLabel, ticketStatuses } from "../data/tickets.js";

const when = (date) => new Date(date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export function TicketStatusBadge({ status }) {
  const [label, className] = ticketStatuses[status] || [status, "bg-gray-100 text-gray-700"];
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{label}</span>;
}

export function TicketSummary({ ticket, customer }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm text-gray-500">{ticket.code}</span>
        <TicketStatusBadge status={ticket.status} />
        {ticket.source === "assistant" && <span className="rounded-full bg-accent-50 px-2.5 py-1 text-xs font-medium text-gray-700">Opened by assistant</span>}
      </div>
      <h3 className="mt-2 font-semibold text-gray-900">{ticket.subject}</h3>
      <p className="mt-1 text-sm text-gray-500">
        {categoryLabel(ticket.category)}
        {ticket.order ? ` | Order ${ticket.order.code}` : ""}
        {customer ? ` | ${customer}` : ""}
        {` | ${when(ticket.createdAt)}`}
      </p>
    </div>
  );
}

// The original request followed by the conversation, plus a reply box.
export function TicketThread({ ticket, viewer, onReply }) {
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const canReply = viewer === "admin" || ticket.status !== "closed";

  async function send(event) {
    event.preventDefault();
    setSending(true);
    setError("");
    try {
      await onReply(reply.trim());
      setReply("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
      <div className="rounded-lg bg-gray-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{viewer === "admin" ? "Customer's request" : "Your request"}</p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{ticket.description}</p>
      </div>
      {ticket.messages.map((message, index) => {
        const fromTeam = message.author === "admin";
        return (
          <div className={`rounded-lg p-4 ${fromTeam ? "border border-brand-200 bg-brand-50" : "bg-gray-50"}`} key={`${message.createdAt}-${index}`}>
            <p className="text-xs font-semibold text-gray-600">
              {fromTeam ? (viewer === "admin" ? `${message.authorName || "Admin"} (team)` : "ANM-Shop support") : (viewer === "admin" ? "Customer" : "You")}
              <span className="font-normal text-gray-500"> · {when(message.createdAt)}</span>
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{message.body}</p>
          </div>
        );
      })}
      {canReply ? (
        <form className="space-y-2" onSubmit={send}>
          <label className="sr-only" htmlFor={`reply-${ticket._id}`}>Reply</label>
          <textarea id={`reply-${ticket._id}`} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" rows={3} maxLength={4000} placeholder={viewer === "admin" ? "Reply to the customer (they are emailed)" : "Add a reply"} value={reply} onChange={(event) => setReply(event.target.value)} />
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
          <button className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60" type="submit" disabled={sending || !reply.trim()}>
            {sending ? "Sending…" : "Send reply"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-gray-500">This ticket is closed. Open a new ticket if you still need help.</p>
      )}
    </div>
  );
}
