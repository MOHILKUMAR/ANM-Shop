import { useEffect, useState } from "react";
import { apiRequest } from "../api.js";
import { ListSkeleton } from "./Skeletons.jsx";
import { formatInr } from "../money.js";

const ORDER_STATUSES = ["pending", "shipped", "delivered"];
const day = (date) => new Date(date).toLocaleDateString("en-IN", { dateStyle: "medium" });
const shortCode = (id) => `#${id.slice(-8).toUpperCase()}`;

// Every customer order, 20 per page, filtered by status. `onChanged` lets the dashboard refresh
// its statistics after a change here.
function AdminOrders({ token, onChanged }) {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ page: String(page) });
    if (status) query.set("status", status);
    apiRequest(`/orders?${query}`, { token })
      .then((result) => {
        if (!active) return;
        setData(result);
        setError("");
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
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

  function changeFilter(next) {
    setLoading(true);
    setNotice("");
    setPage(1);
    setStatus(next);
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

  async function deleteOrder(order) {
    if (!window.confirm(`Delete order ${shortCode(order._id)}?\n\nThis removes the order record only. It does NOT refund the customer or restore stock. The payment record is kept.`)) return;
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
      <h2 className="text-lg font-semibold text-gray-900">Customer orders{allCount === null ? "" : ` (${allCount})`}</h2>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {[["", "All", allCount], ...ORDER_STATUSES.map((value) => [value, value, counts?.[value]])].map(([value, label, count]) => (
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
      </div>

      {notice && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800" role="status">{notice}</p>}
      {error && <p className="rounded-lg bg-red-50 p-4 text-red-700" role="alert">{error}</p>}
      {loading && <ListSkeleton rows={4} label="Loading orders" />}
      {!loading && data?.orders.length === 0 && <p className="rounded-xl bg-gray-50 p-6 text-gray-600">No orders here yet.</p>}

      {!loading && data?.orders.map((order) => (
        <article className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 md:flex-row md:items-center" key={order._id}>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900">Order {shortCode(order._id)}</h3>
            <p className="mt-1 text-sm text-gray-500">{order.user?.name || "Customer"} | {order.user?.email || ""} | {day(order.createdAt)}</p>
            <p className="mt-2 text-sm text-gray-700">{order.items.map((item) => `${item.productId?.name || "Product"} x ${item.qty}`).join(", ")}</p>
          </div>
          <p className="font-semibold text-gray-900">{formatInr(order.totalAmount)}</p>
          <label className="sr-only" htmlFor={`status-${order._id}`}>Order status</label>
          <select className="rounded-lg border border-gray-300 px-3 py-2 capitalize" id={`status-${order._id}`} value={order.status} onChange={(event) => updateStatus(order, event.target.value)}>
            {ORDER_STATUSES.map((value) => <option className="capitalize" key={value} value={value}>{value}</option>)}
          </select>
          <button className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50" type="button" onClick={() => deleteOrder(order)}>Delete</button>
        </article>
      ))}

      {pagination?.pages > 1 && (
        <nav className="flex items-center justify-center gap-4" aria-label="Order pages">
          <button className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-40" type="button" disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage((current) => current - 1); }}>Previous</button>
          <span className="text-sm text-gray-600">Page {pagination.page} of {pagination.pages}</span>
          <button className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-40" type="button" disabled={page >= pagination.pages || loading} onClick={() => { setLoading(true); setPage((current) => current + 1); }}>Next</button>
        </nav>
      )}
    </section>
  );
}

export default AdminOrders;
