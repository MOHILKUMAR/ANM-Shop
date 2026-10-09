import { useState } from "react";
import { apiRequest } from "../api.js";
import { formatInr } from "../money.js";

const shortId = (id) => `#${String(id).slice(-8).toUpperCase()}`;
const when = (date) => (date ? new Date(date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "-");

// Payment records are checkout attempts: most become orders, some are abandoned or refunded.
const paymentStatus = {
  pending: ["Awaiting payment", "bg-gray-100 text-gray-700"],
  completed: ["Paid", "bg-green-50 text-green-800"],
  refund_pending: ["Refund in progress", "bg-amber-50 text-amber-800"],
  refunded: ["Refunded", "bg-brand-50 text-brand-800"],
  refund_failed: ["Refund failed - refund manually", "bg-red-50 text-red-700"],
};

// Each confirmation spells out what the delete does and does not undo.
const deleteRequests = {
  order: (order) => ({
    path: `/orders/${order._id}`,
    confirm: `Delete order ${shortId(order._id)}?\n\nThis removes the order record only. It does NOT refund the customer or restore stock. The payment record is kept.`,
  }),
  payment: (payment) => ({
    path: `/payment/records/${payment._id}`,
    confirm: payment.status === "refund_failed"
      ? `The automatic refund for this payment failed.\n\nOnly delete this record after you have refunded ${payment.paymentId || "the payment"} manually in Razorpay. Delete it now?`
      : "Delete this payment record?\n\nThis only removes the store's record. The payment in Razorpay is not changed or refunded.",
  }),
  user: (user) => ({
    path: `/auth/users/${user._id}`,
    confirm: `Delete the account for ${user.email}?\n\nThey will be signed out and can't sign in again. Their orders and payments are kept as records.`,
  }),
};

function DeleteButton({ label, onClick }) {
  return (
    <button className="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50" type="button" onClick={onClick}>
      {label}
    </button>
  );
}

function StatusBadge({ status }) {
  const [label, className] = paymentStatus[status] || [status, "bg-gray-100 text-gray-700"];
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{label}</span>;
}

// Any id in the results can be clicked to search for it.
function IdLink({ value, label, onSearch }) {
  if (!value) return <span className="text-gray-500">-</span>;
  return (
    <button className="break-all text-left font-mono text-sm text-brand-700 hover:text-brand-900 hover:underline" type="button" title={`Search ${value}`} onClick={() => onSearch(String(value))}>
      {label || value}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{children}</dd>
    </div>
  );
}

function OrderResult({ order, onSearch, onDelete }) {
  const address = order.address || {};
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-3">
        <div>
          <h4 className="font-semibold text-gray-900">Order {shortId(order._id)}</h4>
          <p className="mt-1 font-mono text-xs text-gray-500">{order._id}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium capitalize text-brand-800">{order.status}</span>
          <DeleteButton label="Delete order" onClick={() => onDelete("order", order)} />
        </div>
      </div>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Customer">{order.user?.name || "Deleted account"}<br /><span className="text-gray-500">{order.user?.email || ""}</span></Field>
        <Field label="Total paid">{formatInr(order.totalAmount)}</Field>
        <Field label="Payment ID"><IdLink value={order.paymentId} onSearch={onSearch} /></Field>
        <Field label="Placed">{when(order.createdAt)}</Field>
      </dl>
      <ul className="mt-4 divide-y divide-gray-100 text-sm">
        {order.items.map((item, index) => (
          <li className="flex justify-between gap-3 py-2" key={`${item.productId?._id || item.productId}-${index}`}>
            <span className="text-gray-700">{item.productId?.name || "Deleted product"} × {item.qty}</span>
            <span className="text-gray-900">{formatInr(Number(item.price) * item.qty)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-gray-500">
        Ship to: {[address.fullName, address.street, address.city, address.postalCode, address.country].filter(Boolean).join(", ")}
        {address.phone ? ` | ${address.phone}` : ""}
        {" | "}{order.invoiceEmailSent ? "E-bill sent" : "E-bill not confirmed"}
      </p>
    </article>
  );
}

function PaymentResult({ payment, onSearch, onDelete }) {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-3">
        <div>
          <h4 className="font-semibold text-gray-900">{formatInr(payment.amountPaise / 100)} checkout</h4>
          <p className="mt-1 text-sm text-gray-500">{payment.user?.name || "Deleted account"} {payment.user?.email ? `| ${payment.user.email}` : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={payment.status} />
          <DeleteButton label="Delete record" onClick={() => onDelete("payment", payment)} />
        </div>
      </div>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Razorpay payment ID"><IdLink value={payment.paymentId} onSearch={onSearch} /></Field>
        <Field label="Razorpay order ID"><IdLink value={payment.razorpayOrderId} onSearch={onSearch} /></Field>
        <Field label="Store order"><IdLink value={payment.order} label={payment.order ? shortId(payment.order) : ""} onSearch={onSearch} /></Field>
        {payment.refundId && <Field label="Refund ID"><span className="font-mono">{payment.refundId}</span></Field>}
        {payment.failureReason && <Field label="Reason">{payment.failureReason}</Field>}
        <Field label="Started">{when(payment.createdAt)}</Field>
        <Field label="Last update">{when(payment.updatedAt)}</Field>
      </dl>
    </article>
  );
}

function CustomerResult({ customer, onSearch, onDelete }) {
  const { user } = customer;
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-3">
        <div>
          <h4 className="font-semibold text-gray-900">{user.name}</h4>
          <p className="mt-1 text-sm text-gray-500">{user.email}</p>
          <p className="mt-1 font-mono text-xs text-gray-500">{user._id}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          {user.role === "admin" && <span className="rounded-full bg-brand-50 px-3 py-1 text-brand-800">Admin</span>}
          <span className={`rounded-full px-3 py-1 ${user.verified ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>{user.verified ? "Verified" : "Not verified"}</span>
          {/* Admin accounts are protected on the server; already-deleted accounts have no email. */}
          {user.role !== "admin" && user.email && <DeleteButton label="Delete account" onClick={() => onDelete("user", user)} />}
        </div>
      </div>
      <p className="mt-4 text-sm text-gray-700">{customer.orderCount} order{customer.orderCount === 1 ? "" : "s"} | {formatInr(customer.totalSpent)} spent</p>

      <h5 className="mt-5 text-sm font-semibold text-gray-900">Order history</h5>
      {customer.orders.length ? (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-gray-500">
              <tr><th className="py-2 pr-3 font-medium">Order</th><th className="py-2 pr-3 font-medium">Date</th><th className="py-2 pr-3 font-medium">Total</th><th className="py-2 pr-3 font-medium">Status</th><th className="py-2 font-medium">Payment ID</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customer.orders.map((order) => (
                <tr key={order._id}>
                  <td className="py-2 pr-3"><IdLink value={order._id} label={shortId(order._id)} onSearch={onSearch} /></td>
                  <td className="py-2 pr-3 text-gray-700">{when(order.createdAt)}</td>
                  <td className="py-2 pr-3 text-gray-900">{formatInr(order.totalAmount)}</td>
                  <td className="py-2 pr-3 capitalize text-gray-700">{order.status}</td>
                  <td className="py-2"><IdLink value={order.paymentId} onSearch={onSearch} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="mt-2 text-sm text-gray-500">No orders yet.</p>}

      <h5 className="mt-5 text-sm font-semibold text-gray-900">Payment history</h5>
      {customer.payments.length ? (
        <ul className="mt-2 divide-y divide-gray-100 text-sm">
          {customer.payments.map((payment) => (
            <li className="flex flex-wrap items-center justify-between gap-3 py-2" key={payment._id}>
              <span className="text-gray-700">{when(payment.createdAt)} | {formatInr(payment.amountPaise / 100)}</span>
              <IdLink value={payment.paymentId || payment.razorpayOrderId} onSearch={onSearch} />
              <StatusBadge status={payment.status} />
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-sm text-gray-500">No payments yet.</p>}
    </article>
  );
}

function ResultSection({ title, count, children }) {
  if (!count) return null;
  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold text-gray-900">{title} ({count})</h3>
      {children}
    </section>
  );
}

function AdminSearch({ token }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function runSearch(value) {
    const term = value.trim();
    if (!term) return;
    setQuery(term);
    setSearching(true);
    setError("");
    setNotice("");
    try {
      setResults(await apiRequest(`/admin/search?q=${encodeURIComponent(term)}`, { token }));
    } catch (requestError) {
      setResults(null);
      setError(requestError.message);
    } finally {
      setSearching(false);
    }
  }

  async function deleteRecord(kind, record) {
    const { path, confirm } = deleteRequests[kind](record);
    if (!window.confirm(confirm)) return;
    setError("");
    setNotice("");
    try {
      const result = await apiRequest(path, { method: "DELETE", token });
      await runSearch(results.query); // refresh so the deleted record disappears
      setNotice(result.message);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  const total = results ? results.orders.length + results.payments.length + results.customers.length : 0;

  return (
    <section className="space-y-6">
      <form className="rounded-xl border border-gray-200 bg-white p-5" onSubmit={(event) => { event.preventDefault(); runSearch(query); }}>
        <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="admin-search">Search orders, payments, and customers</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input id="admin-search" className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" type="search" maxLength={100} placeholder="#A1B2C3D4, order ID, pay_..., order_..., or email" value={query} onChange={(event) => setQuery(event.target.value)} />
          <button className="rounded-lg bg-brand-700 px-5 py-2.5 font-semibold text-white hover:bg-brand-800 disabled:opacity-60" type="submit" disabled={searching || !query.trim()}>{searching ? "Searching..." : "Search"}</button>
        </div>
        <p className="mt-2 text-xs text-gray-500">Order codes are the 8 characters after # on an order. Razorpay IDs start with pay_ (payment) or order_ (checkout).</p>
      </form>

      {error && <p className="rounded-lg bg-red-50 p-4 text-red-700" role="alert">{error}</p>}
      {notice && <p className="rounded-lg bg-green-50 p-4 text-green-800" role="status">{notice}</p>}
      {results && total === 0 && <p className="rounded-xl bg-gray-50 p-6 text-gray-600">No orders, payments, or customers match "{results.query}".</p>}
      {results && total > 0 && (
        <div className="space-y-8">
          <ResultSection title="Orders" count={results.orders.length}>
            {results.orders.map((order) => <OrderResult key={order._id} order={order} onSearch={runSearch} onDelete={deleteRecord} />)}
          </ResultSection>
          <ResultSection title="Payments" count={results.payments.length}>
            {results.payments.map((payment) => <PaymentResult key={payment._id} payment={payment} onSearch={runSearch} onDelete={deleteRecord} />)}
          </ResultSection>
          <ResultSection title="Customers" count={results.customers.length}>
            {results.customers.map((customer) => <CustomerResult key={customer.user._id} customer={customer} onSearch={runSearch} onDelete={deleteRecord} />)}
          </ResultSection>
        </div>
      )}
    </section>
  );
}

export default AdminSearch;
