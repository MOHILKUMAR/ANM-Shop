import { useEffect, useRef, useState } from "react";
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
  // The open thread as it is now, for replies and reloads that finish later.
  const openRef = useRef(null);
  // Kept apart, so a reload that works doesn't hide a status change that failed.
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  // Each reload gets a new number (from a counter, so a late reply can't reuse an old one).
  const [reloadKey, setReloadKey] = useState(0);
  const reloads = useRef(0);
  // The ticket whose thread is open when it changes: a reply (or status change) puts it at the
  // top of the list, so the reload that follows the change goes to page 1 with it.
  const following = useRef(null);

  useEffect(() => {
    let active = true;
    apiRequest(`/tickets?${ticketQuery(page, filter)}`, { token })
      .then((result) => {
        if (!active) return;
        // Only the reload for that change, on the page where it was made, follows it.
        const note = following.current;
        const followed = note?.reloadKey === reloadKey && note.filter === filter && note.page === page && note.id === openRef.current ? note : null;
        if (followed) following.current = null;
        setLoadError("");
        const lastPage = Math.max(result.pagination?.pages || 1, 1);
        // A change can empty the last page: show the page that is now last.
        if (page > lastPage) {
          setData(null);
          setPage(lastPage);
          return;
        }
        // The ticket being worked on moved to the top of the list (page 1): go there, thread still open.
        if (followed && page > 1 && !result.tickets.some((ticket) => ticket._id === followed.id)) {
          setData(null);
          setPage(1);
          return;
        }
        setData(result);
      })
      .catch((requestError) => {
        if (active) setLoadError(requestError.message);
      });
    return () => {
      active = false;
    };
  }, [token, filter, page, reloadKey]);

  useEffect(() => {
    openRef.current = openId;
  }, [openId]);

  function chooseFilter(next) {
    following.current = null;
    setData(null);
    setLoadError("");
    setActionError("");
    setFilter(next);
    setPage(1);
    setReloadKey((reloads.current += 1)); // reloads even when this filter and page are already shown
  }

  function goToPage(next) {
    following.current = null;
    setData(null);
    setPage(next);
  }

  // Shows the change at once, then reloads the page: tickets that no longer match the filter
  // leave and the next ones move up, and the counts update.
  function applyUpdate(updated) {
    const stillListed = !filter || updated.status === filter;
    setData((current) => current && {
      ...current,
      tickets: current.tickets
        .map((ticket) => (ticket._id === updated._id ? updated : ticket))
        .filter((ticket) => ticket._id !== updated._id || stillListed),
    });
    const next = (reloads.current += 1);
    const note = following.current;
    if (stillListed && updated._id === openRef.current) following.current = { id: updated._id, filter, page, reloadKey: next };
    // This reload replaces one still following an earlier change to another ticket.
    else if (note && note.id !== updated._id) following.current = { ...note, reloadKey: next };
    else following.current = null;
    setReloadKey(next);
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
    setActionError("");
    try {
      applyUpdate(await apiRequest(`/tickets/${ticketId}/status`, {
        method: "PUT",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }));
    } catch (requestError) {
      setActionError(requestError.message);
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

      {actionError && <p className="rounded-lg bg-red-50 p-4 text-red-700" role="alert">{actionError}</p>}
      {loadError && <p className="rounded-lg bg-red-50 p-4 text-red-700" role="alert">{loadError}</p>}
      {!data && !loadError && <ListSkeleton rows={4} label="Loading tickets" />}
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
