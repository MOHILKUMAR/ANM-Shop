import { useEffect, useState } from "react";
import { apiRequest } from "../api.js";
import { ListSkeleton } from "./Skeletons.jsx";
import { TicketSummary, TicketThread } from "./TicketThread.jsx";
import { ticketStatuses } from "../data/tickets.js";
import { formatInr } from "../money.js";

const ticketQuery = (page, status) => new URLSearchParams({ page: String(page), ...(status ? { status } : {}) });

function AdminTickets({ token }) {
  const [filter, setFilter] = useState("open");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest(`/tickets?${ticketQuery(page, filter)}`, { token })
      .then((result) => {
        if (!active) return;
        // A status change can empty the last page; go to the page that is now last.
        const lastPage = Math.max(result.pagination?.pages || 1, 1);
        if (page > lastPage) {
          setPage(lastPage);
          return;
        }
        setData(result);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      });
    return () => {
      active = false;
    };
  }, [token, filter, page]);

  function chooseFilter(next) {
    setData(null);
    setError("");
    setFilter(next);
    setPage(1);
  }

  function goToPage(next) {
    setData(null);
    setPage(next);
  }

  // Replace one ticket in place, or drop it when it no longer matches the status filter. Only the
  // counts are reloaded: reloading the page would move a ticket just answered to page 1, out of view.
  function applyUpdate(updated) {
    setData((current) => ({
      ...current,
      tickets: current.tickets
        .map((ticket) => (ticket._id === updated._id ? updated : ticket))
        .filter((ticket) => !filter || ticket.status === filter),
    }));
    apiRequest(`/tickets?${ticketQuery(page, filter)}`, { token })
      .then((result) => {
        // The change emptied the last page: go to the page that is now last.
        if (page > Math.max(result.pagination?.pages || 1, 1)) {
          goToPage(Math.max(result.pagination?.pages || 1, 1));
          return;
        }
        setData((current) => current && { ...current, counts: result.counts, pagination: result.pagination });
      })
      .catch(() => {});
  }

  async function reply(ticketId, body) {
    const updated = await apiRequest(`/tickets/${ticketId}/messages`, {
      method: "POST",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    applyUpdate(updated);
  }

  async function changeStatus(ticketId, status) {
    setError("");
    try {
      applyUpdate(await apiRequest(`/tickets/${ticketId}/status`, {
        method: "PUT",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  const counts = data?.counts;
  const pagination = data?.pagination;
  const filters = [["", "All"], ...Object.entries(ticketStatuses).map(([value, [label]]) => [value, label])];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Support tickets</h2>
        <p className="mt-1 text-sm text-gray-500">Customers are emailed when you reply or change a ticket's status.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter tickets by status">
        {filters.map(([value, label]) => (
          <button
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${filter === value ? "border-brand-600 bg-brand-50 text-brand-800" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
            key={value || "all"}
            type="button"
            aria-pressed={filter === value}
            onClick={() => chooseFilter(value)}
          >
            {label}{counts ? ` (${value ? counts[value] : Object.values(counts).reduce((sum, count) => sum + count, 0)})` : ""}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-red-50 p-4 text-red-700" role="alert">{error}</p>}
      {!data && !error && <ListSkeleton rows={4} label="Loading tickets" />}
      {data && data.tickets.length === 0 && <p className="rounded-xl bg-gray-50 p-6 text-gray-600">No tickets here.</p>}
      {data?.tickets.map((ticket) => (
        <article className="rounded-xl border border-gray-200 bg-white p-5" key={ticket._id}>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <button className="min-w-0 flex-1 text-left" type="button" aria-expanded={openId === ticket._id} onClick={() => setOpenId((current) => (current === ticket._id ? null : ticket._id))}>
              <TicketSummary ticket={ticket} customer={ticket.user ? `${ticket.user.name} (${ticket.user.email})` : "Deleted account"} />
            </button>
            <div className="flex shrink-0 items-center gap-2">
              <label className="sr-only" htmlFor={`ticket-status-${ticket._id}`}>Ticket status</label>
              <select id={`ticket-status-${ticket._id}`} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" value={ticket.status} onChange={(event) => changeStatus(ticket._id, event.target.value)}>
                {Object.entries(ticketStatuses).map(([value, [label]]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <button className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50" type="button" onClick={() => setOpenId((current) => (current === ticket._id ? null : ticket._id))}>
                {openId === ticket._id ? "Hide" : "Open"}
              </button>
            </div>
          </div>
          {openId === ticket._id && (
            <>
              {ticket.order?.totalAmount !== undefined && (
                <p className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                  Order {ticket.order.code}: {formatInr(ticket.order.totalAmount)} · <span className="capitalize">{ticket.order.status}</span> · placed {new Date(ticket.order.createdAt).toLocaleDateString("en-IN")} · payment <span className="font-mono">{ticket.order.paymentId || "-"}</span>
                </p>
              )}
              <TicketThread ticket={ticket} viewer="admin" onReply={(body) => reply(ticket._id, body)} />
            </>
          )}
        </article>
      ))}
      {pagination?.pages > 1 && (
        <nav className="flex items-center justify-center gap-4" aria-label="Ticket pages">
          <button className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-40" type="button" disabled={page <= 1 || !data} onClick={() => goToPage(page - 1)}>Previous</button>
          <span className="text-sm text-gray-600">Page {pagination.page} of {pagination.pages}</span>
          <button className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-40" type="button" disabled={page >= pagination.pages || !data} onClick={() => goToPage(page + 1)}>Next</button>
        </nav>
      )}
    </section>
  );
}

export default AdminTickets;
