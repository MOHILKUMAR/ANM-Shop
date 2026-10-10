import { useEffect, useState } from "react";
import { apiRequest } from "../api.js";
import { ListSkeleton } from "./Skeletons.jsx";
import { formatInr } from "../money.js";

// Statuses an admin sets by hand; cancelled and returned come from the actions below.
const SHIPPING_STATUSES = ["pending", "shipped", "delivered"];
const FILTERS = [...SHIPPING_STATUSES, "cancelled", "returned"];
// Orders whose refund failed or never finished (the server's `refund=problem` filter).
const REFUND_PROBLEMS = "refund-problems";
// A refund still in progress after this long was interrupted; the server allows a retry then.
const STUCK_REFUND_MS = 10 * 60 * 1000;
const day = (date) => new Date(date).toLocaleDateString("en-IN", { dateStyle: "medium" });
const shortCode = (id) => `#${id.slice(-8).toUpperCase()}`;
const isStuck = (refund, loadedAt) => refund?.status === "pending" && loadedAt - new Date(refund.requestedAt).getTime() > STUCK_REFUND_MS;

function RefundStatus({ order, stuck }) {
  const refund = order.refund;
  if (!refund?.status) return null;
  const amount = formatInr(refund.amount);
  if (refund.status === "refunded") return <p className="mt-2 text-sm text-green-700">Refunded {amount}{refund.razorpayRefundId ? ` · ${refund.razorpayRefundId}` : ""}</p>;
  if (refund.status === "failed") return <p className="mt-2 text-sm font-medium text-red-700">Refund of {amount} failed: {refund.error || "Razorpay refused it"}</p>;
  if (stuck) return <p className="mt-2 text-sm font-medium text-red-700">Refund of {amount} was interrupted and hasn’t finished. Retry it (a refund Razorpay already made is detected, not repeated).</p>;
  return <p className="mt-2 text-sm text-amber-800">Refund of {amount} in progress</p>;
}

// Every customer order, 20 per page, filtered by status. `onChanged` lets the dashboard refresh
// its statistics after a change here.
function AdminOrders({ token, onChanged }) {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  // Kept apart, so a reload that works doesn't hide an action's error (e.g. a failed refund retry).
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  // The order whose return is being confirmed, and whether its items go back on sale.
  const [returning, setReturning] = useState(null);

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ page: String(page) });
    if (status === REFUND_PROBLEMS) query.set("refund", "problem");
    else if (status) query.set("status", status);
    let movingPage = false;
    apiRequest(`/orders?${query}`, { token })
      .then((result) => {
        if (!active) return;
        // An action can empty the last page; go to the page that is now last (still loading, so
        // the old rows and their buttons aren't shown meanwhile).
        const lastPage = Math.max(result.pagination?.pages || 1, 1);
        if (page > lastPage) {
          movingPage = true;
          setPage(lastPage);
          return;
        }
        setData({ ...result, loadedAt: Date.now() });
        setLoadError("");
      })
      .catch((requestError) => {
        if (active) setLoadError(requestError.message);
      })
      .finally(() => {
        if (active && !movingPage) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, status, page, reloadKey]);

  function reload(message) {
    setNotice(message || "");
    setLoading(true);
    setReloadKey((key) => key + 1);
    onChanged?.();
  }

  // A message about an order on this page would be out of place on the next one.
  function goToPage(next) {
    setLoading(true);
    setNotice("");
    setError("");
    setPage(next);
  }

  function changeFilter(next) {
    setLoading(true);
    setNotice("");
    setError("");
    setPage(1);
    setStatus(next);
  }

  // Runs one order action; the server's message becomes the notice.
  async function act(order, path, options = {}) {
    setBusyId(order._id);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest(`/orders/${order._id}${path}`, {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      });
      setReturning(null);
      reload(`${shortCode(order._id)}: ${result.message}`);
    } catch (requestError) {
      setError(`${shortCode(order._id)}: ${requestError.message}`);
      if (requestError.status === 502) reload(); // the failed retry is recorded on the order
    } finally {
      setBusyId("");
    }
  }

  async function updateStatus(order, next) {
    setError("");
    try {
      await apiRequest(`/orders/${order._id}/status`, {
        method: "PUT",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      reload(`Order ${shortCode(order._id)} marked ${next}.`);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function cancelOrder(order) {
    if (!window.confirm(`Cancel order ${shortCode(order._id)} and refund ${formatInr(order.totalAmount)} to the customer?\n\nThe items go back into stock and the customer is emailed.`)) return;
    act(order, "/cancel");
  }

  async function deleteOrder(order) {
    if (!window.confirm(`Delete order ${shortCode(order._id)}?\n\nThis removes the order record only. It does NOT refund the customer or restore stock. To refund, cancel it or mark it returned instead.`)) return;
    setError("");
    try {
      const result = await apiRequest(`/orders/${order._id}`, { method: "DELETE", token });
      reload(result.message);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  const counts = data?.counts;
  const pagination = data?.pagination;
  const allCount = counts ? Object.values(counts).reduce((sum, count) => sum + count, 0) : null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Customer orders{allCount === null ? "" : ` (${allCount})`}</h2>
        <p className="mt-1 text-sm text-gray-500">Cancelling (before shipping) or marking a return refunds the full amount through Razorpay and emails the customer.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {[["", "All", allCount], ...FILTERS.map((value) => [value, value, counts?.[value]])].map(([value, label, count]) => (
          <button
            className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize ${status === value ? "bg-brand-700 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
            key={value || "all"}
            type="button"
            aria-pressed={status === value}
            onClick={() => changeFilter(value)}
          >
            {label}{count === null || count === undefined ? "" : ` (${count})`}
          </button>
        ))}
        {(data?.refundProblems > 0 || status === REFUND_PROBLEMS) && (
          <button
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${status === REFUND_PROBLEMS ? "bg-red-700 text-white" : "bg-red-50 text-red-700 hover:bg-red-100"}`}
            type="button"
            aria-pressed={status === REFUND_PROBLEMS}
            onClick={() => changeFilter(REFUND_PROBLEMS)}
          >
            Refund problems ({data?.refundProblems ?? 0})
          </button>
        )}
      </div>

      {notice && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800" role="status">{notice}</p>}
      {error && <p className="rounded-lg bg-red-50 p-4 text-red-700" role="alert">{error}</p>}
      {loadError && <p className="rounded-lg bg-red-50 p-4 text-red-700" role="alert">{loadError}</p>}
      {loading && <ListSkeleton rows={4} label="Loading orders" />}
      {!loading && data?.orders.length === 0 && <p className="rounded-xl bg-gray-50 p-6 text-gray-600">No orders here yet.</p>}

      {!loading && data?.orders.map((order) => {
        const closed = order.status === "cancelled" || order.status === "returned";
        const busy = busyId === order._id;
        const stuck = isStuck(order.refund, data.loadedAt);
        return (
          <article className="rounded-xl border border-gray-200 bg-white p-5" key={order._id}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-gray-900">Order {shortCode(order._id)}</h3>
                <p className="mt-1 text-sm text-gray-500">{order.user?.name || "Customer"} | {order.user?.email || ""} | {day(order.createdAt)}</p>
                <p className="mt-2 text-sm text-gray-700">{order.items.map((item) => `${item.productId?.name || "Product"} x ${item.qty}`).join(", ")}</p>
                {closed && (
                  <p className="mt-2 text-sm text-gray-600">
                    <span className="capitalize">{order.status}</span>{order.closedAt ? ` on ${day(order.closedAt)}` : ""}{order.closedBy ? ` by the ${order.closedBy}` : ""}{order.restocked ? " · items back in stock" : order.restocked === false ? " · not restocked" : ""}{order.refund?.reason ? ` · “${order.refund.reason}”` : ""}
                  </p>
                )}
                <RefundStatus order={order} stuck={stuck} />
              </div>
              <p className="font-semibold text-gray-900">{formatInr(order.totalAmount)}</p>
              {closed ? (
                <span className="rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium capitalize text-gray-700">{order.status}</span>
              ) : (
                <>
                  <label className="sr-only" htmlFor={`status-${order._id}`}>Order status</label>
                  <select className="rounded-lg border border-gray-300 px-3 py-2 capitalize" id={`status-${order._id}`} value={order.status} disabled={busy} onChange={(event) => updateStatus(order, event.target.value)}>
                    {SHIPPING_STATUSES.map((value) => <option className="capitalize" key={value} value={value}>{value}</option>)}
                  </select>
                </>
              )}
              <div className="flex flex-wrap gap-1">
                {order.status === "pending" && (
                  <button className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50" type="button" disabled={busy} onClick={() => cancelOrder(order)}>Cancel &amp; refund</button>
                )}
                {(order.status === "shipped" || order.status === "delivered") && (
                  <button className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50" type="button" disabled={busy} onClick={() => setReturning({ id: order._id, restock: false, reason: "" })}>Mark returned</button>
                )}
                {(order.refund?.status === "failed" || stuck) && (
                  <button className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50" type="button" disabled={busy} onClick={() => act(order, "/refund")}>{busy ? "Retrying..." : "Retry refund"}</button>
                )}
                {/* An unfinished refund is the record that money is owed; the server refuses too. */}
                {order.refund?.status !== "pending" && order.refund?.status !== "failed" && (
                  <button className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50" type="button" onClick={() => deleteOrder(order)}>Delete</button>
                )}
              </div>
            </div>

            {returning?.id === order._id && (
              <form className="mt-4 space-y-3 rounded-lg bg-gray-50 p-4" onSubmit={(event) => { event.preventDefault(); act(order, "/return", { restock: returning.restock, reason: returning.reason }); }}>
                <p className="text-sm text-gray-700">Mark {shortCode(order._id)} as returned and refund {formatInr(order.totalAmount)} to the customer.</p>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={returning.restock} onChange={(event) => setReturning((current) => ({ ...current, restock: event.target.checked }))} />
                  Put the items back in stock (only if unopened and resellable)
                </label>
                <div>
                  <label className="mb-1 block text-sm text-gray-700" htmlFor={`return-reason-${order._id}`}>Reason (optional, for your records)</label>
                  <input id={`return-reason-${order._id}`} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" maxLength={300} value={returning.reason} onChange={(event) => setReturning((current) => ({ ...current, reason: event.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <button className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60" type="submit" disabled={busy}>{busy ? "Refunding..." : "Confirm return & refund"}</button>
                  <button className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-white" type="button" onClick={() => setReturning(null)}>Back</button>
                </div>
              </form>
            )}
          </article>
        );
      })}

      {pagination?.pages > 1 && (
        <nav className="flex items-center justify-center gap-4" aria-label="Order pages">
          <button className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-40" type="button" disabled={page <= 1 || loading} onClick={() => goToPage(page - 1)}>Previous</button>
          <span className="text-sm text-gray-600">Page {pagination.page} of {pagination.pages}</span>
          <button className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-40" type="button" disabled={page >= pagination.pages || loading} onClick={() => goToPage(page + 1)}>Next</button>
        </nav>
      )}
    </section>
  );
}

export default AdminOrders;
