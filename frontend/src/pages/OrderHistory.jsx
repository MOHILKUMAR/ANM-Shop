import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api.js";
import AuthContext from "../context/AuthContext.js";
import { usePageMeta } from "../usePageMeta.js";
import { formatInr } from "../money.js";
import { businessInfo, showBusinessDetails } from "../data/contactInfo.js";

const formatMoney = (amount) => `INR ${Number(amount || 0).toFixed(2)}`;
const orderDate = (date) => new Date(date).toLocaleDateString("en-IN", { dateStyle: "medium" });
const statusBadge = {
  cancelled: "bg-gray-100 text-gray-700",
  returned: "bg-gray-100 text-gray-700",
};

// What happened to the money for a cancelled or returned order.
function RefundNote({ refund }) {
  if (!refund?.status) return null;
  const amount = formatInr(refund.amount);
  if (refund.status === "refunded") {
    return <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">Refund of {amount} issued{refund.completedAt ? ` on ${orderDate(refund.completedAt)}` : ""}. It usually reaches your account in 5 to 7 working days.</p>;
  }
  return <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Refund of {amount} in progress. If it hasn't arrived after 7 working days, contact us on the Support page.</p>;
}

// Subtotal, shipping and discount for orders that have them; empty for older orders.
const breakdownLines = (order) => (order.subtotalAmount === undefined || order.subtotalAmount === null ? [] : [
  ["Subtotal", formatMoney(order.subtotalAmount)],
  ["Shipping", order.shippingFee ? formatMoney(order.shippingFee) : "Free"],
  ...(order.discountAmount ? [[`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`, `-${formatMoney(order.discountAmount)}`]] : []),
]);

async function downloadBill(order) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 18;
  const right = pageWidth - margin;
  let y = 58;

  pdf.setFillColor(87, 52, 67);
  pdf.rect(0, 0, pageWidth, 43, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(21);
  pdf.text("ANM-Shop", margin, 19);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text("BEAUTY FOR EVERYDAY RITUALS", margin, 27);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.text("PAYMENT RECEIPT / E-BILL", right, 20, { align: "right" });

  pdf.setTextColor(53, 39, 48);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("Order details", margin, y);
  y += 7;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  const details = [
    [`Order number: ${String(order._id)}`, `Date: ${orderDate(order.createdAt)}`],
    [`Payment ID: ${order.paymentId || "Not available"}`, `Status: ${String(order.status || "pending").toUpperCase()}`],
  ];
  for (const [left, rightText] of details) {
    pdf.text(left, margin, y);
    pdf.text(rightText, right, y, { align: "right" });
    y += 6;
  }

  // The seller, once its details are filled in (data/contactInfo.js).
  if (showBusinessDetails()) {
    const business = businessInfo();
    const width = pageWidth - margin * 2;
    y += 4;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text("Sold by", margin, y);
    y += 6;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    const sellerLines = [
      ...pdf.splitTextToSize(business.legalName, width),
      ...pdf.splitTextToSize(business.address, width),
      [business.gstin && `GSTIN: ${business.gstin}`, business.phone && `Phone: ${business.phone}`].filter(Boolean).join("    "),
    ].filter(Boolean);
    pdf.text(sellerLines, margin, y);
    y += (sellerLines.length - 1) * (pdf.getLineHeight() / pdf.internal.scaleFactor) + 6;
  }

  y += 4;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("Delivery address", margin, y);
  y += 6;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  const address = order.address || {};
  const addressLines = pdf.splitTextToSize(
    [address.fullName, address.street, address.city, address.postalCode, address.country, address.phone && `Phone: ${address.phone}`].filter(Boolean).join(", ") || "Not provided",
    pageWidth - margin * 2,
  );
  pdf.text(addressLines, margin, y);
  y += addressLines.length * 5 + 9;

  const columns = { item: margin, qty: 128, unit: 151, total: right };
  const drawTableHeader = () => {
    pdf.setFillColor(244, 231, 232);
    pdf.roundedRect(margin, y - 5, pageWidth - margin * 2, 10, 2, 2, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(87, 52, 67);
    pdf.text("PRODUCT", columns.item + 2, y + 1);
    pdf.text("QTY", columns.qty, y + 1, { align: "right" });
    pdf.text("PRICE", columns.unit, y + 1, { align: "right" });
    pdf.text("AMOUNT", columns.total, y + 1, { align: "right" });
    y += 9;
  };

  drawTableHeader();
  for (const item of order.items || []) {
    const nameLines = pdf.splitTextToSize(item.productId?.name || "ANM-Shop beauty product", 96);
    const rowHeight = Math.max(9, nameLines.length * 4.5 + 3);
    if (y + rowHeight > pageHeight - 34) {
      pdf.addPage();
      y = 22;
      drawTableHeader();
    }
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(53, 39, 48);
    pdf.text(nameLines, columns.item + 2, y);
    pdf.text(String(item.qty), columns.qty, y, { align: "right" });
    pdf.text(formatMoney(item.price), columns.unit, y, { align: "right" });
    pdf.text(formatMoney(Number(item.price) * Number(item.qty)), columns.total, y, { align: "right" });
    y += rowHeight;
    pdf.setDrawColor(233, 224, 220);
    pdf.line(margin, y - 2, right, y - 2);
  }

  // The totals, any refund line and the closing line stay together, above the bottom margin.
  const breakdown = breakdownLines(order);
  const closingHeight = 8 + breakdown.length * 6 + (order.refund?.status ? 8 : 0) + 14;
  if (y + closingHeight > pageHeight - 15) {
    pdf.addPage();
    y = 24;
  }
  y += 8;
  // Orders placed before shipping and coupons existed only have a total.
  for (const [label, value] of breakdown) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(113, 100, 108);
    pdf.text(label, columns.unit, y, { align: "right" });
    pdf.text(value, columns.total, y, { align: "right" });
    y += 6;
  }
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(87, 52, 67);
  pdf.text("TOTAL PAID", columns.unit, y, { align: "right" });
  pdf.text(formatMoney(order.totalAmount), columns.total, y, { align: "right" });
  // A cancelled or returned order was refunded; the bill says so.
  if (order.refund?.status) {
    y += 8;
    pdf.setFontSize(11);
    pdf.text(order.refund.status === "refunded" ? "REFUNDED" : "REFUND IN PROGRESS", columns.unit, y, { align: "right" });
    pdf.text(`-${formatMoney(order.refund.amount)}`, columns.total, y, { align: "right" });
  }
  y += 14;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(113, 100, 108);
  pdf.text("Thank you for shopping with ANM-Shop.", margin, y);

  pdf.save(`ANM-Shop-Bill-${String(order._id).slice(-8).toUpperCase()}.pdf`);
}

function OrderHistory() {
  const { user } = useContext(AuthContext);
  const [orders, setOrders] = useState([]);
  usePageMeta({ title: "My orders", noindex: true });
  const [loading, setLoading] = useState(Boolean(user?.token));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sendingInvoiceId, setSendingInvoiceId] = useState("");
  const [cancellingId, setCancellingId] = useState("");
  // A failed cancel or e-bill resend; shown above the list without hiding it.
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!user?.token) return undefined;

    let active = true;
    apiRequest("/orders/myorders", { token: user.token })
      .then((data) => {
        if (active) setOrders(Array.isArray(data) ? data : []);
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
  }, [user?.token]);

  async function resendInvoice(orderId) {
    setSendingInvoiceId(orderId);
    setActionError("");
    setNotice("");
    try {
      const result = await apiRequest(`/orders/${orderId}/resend-invoice`, {
        method: "POST",
        token: user.token,
      });
      setOrders((currentOrders) => currentOrders.map((order) =>
        order._id === orderId ? { ...order, invoiceEmailSent: true } : order,
      ));
      setNotice(result.message);
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setSendingInvoiceId("");
    }
  }

  // Only orders that haven't shipped can be cancelled; the full amount is refunded.
  async function cancelOrder(order) {
    const code = `#${order._id.slice(-8).toUpperCase()}`;
    if (!window.confirm(`Cancel order ${code}?

You'll get a full refund of ${formatInr(order.totalAmount)} to your original payment method, usually within 5 to 7 working days.`)) return;
    setCancellingId(order._id);
    setActionError("");
    setNotice("");
    try {
      const result = await apiRequest(`/orders/${order._id}/cancel`, {
        method: "POST",
        token: user.token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      // Keep the item names already on screen; take the new status and refund from the reply.
      setOrders((currentOrders) => currentOrders.map((item) => (item._id === order._id
        ? { ...item, status: result.order.status, refund: result.order.refund, closedAt: result.order.closedAt }
        : item)));
      setNotice(result.message);
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setCancellingId("");
    }
  }

  if (!user) {
    return (
      <main className="mx-auto min-h-[60vh] max-w-3xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Sign in to view orders</h1>
        <Link className="mt-6 inline-block font-semibold text-brand-700" to="/login">Sign in</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-[60vh] max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-brand-700">Your account</p>
      <h1 className="mb-8 text-3xl font-bold text-gray-900">Order history</h1>
      {notice && <p className="mb-5 rounded-lg bg-green-50 p-4 text-green-800" role="status">{notice}</p>}
      {actionError && <p className="mb-5 rounded-lg bg-red-50 p-4 text-red-700" role="alert">{actionError}</p>}
      {loading && <p className="py-12 text-center text-gray-600">Loading orders…</p>}
      {!loading && error && <p className="rounded-lg bg-red-50 p-4 text-red-700" role="alert">{error}</p>}
      {!loading && !error && orders.length === 0 && (
        <div className="rounded-2xl bg-gray-50 p-10 text-center">
          <p className="text-gray-700">You haven’t placed any orders yet.</p>
          <Link className="mt-5 inline-block font-semibold text-brand-700" to="/shop">Browse the shop</Link>
        </div>
      )}
      {!loading && !error && orders.length > 0 && (
        <div className="space-y-5">
          {orders.map((order) => (
            <article className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6" key={order._id}>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4">
                <div>
                  <h2 className="font-semibold text-gray-900">Order #{order._id.slice(-8).toUpperCase()}</h2>
                  <p className="mt-1 text-sm text-gray-500">{orderDate(order.createdAt)}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-sm font-medium capitalize ${statusBadge[order.status] || "bg-brand-50 text-brand-800"}`}>{order.status}</span>
              </div>
              <ul className="divide-y divide-gray-100">
                {order.items.map((item, index) => (
                  <li className="flex items-center justify-between gap-4 py-3 text-sm" key={`${item.productId?._id || item.productId}-${index}`}>
                    <span className="text-gray-700">{item.productId?.name || "Product"} × {item.qty}</span>
                    <span className="font-medium text-gray-900">{formatInr(Number(item.price) * item.qty)}</span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-gray-100 pt-4">
                {order.subtotalAmount !== undefined && order.subtotalAmount !== null && (
                  <dl className="mb-2 space-y-1 text-sm">
                    <div className="flex justify-between"><dt className="text-gray-600">Subtotal</dt><dd className="text-gray-900">{formatInr(order.subtotalAmount)}</dd></div>
                    <div className="flex justify-between"><dt className="text-gray-600">Shipping</dt><dd className="text-gray-900">{order.shippingFee ? formatInr(order.shippingFee) : "Free"}</dd></div>
                    {order.discountAmount > 0 && (
                      <div className="flex justify-between text-green-700"><dt>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</dt><dd>−{formatInr(order.discountAmount)}</dd></div>
                    )}
                  </dl>
                )}
                <div className="flex justify-between font-semibold text-gray-900">
                  <span>Total paid</span>
                  <span>{formatInr(order.totalAmount)}</span>
                </div>
              </div>
              <RefundNote refund={order.refund} />
              <p className="mt-3 text-sm text-gray-500">Delivering to {order.address?.city}, {order.address?.country}{order.address?.phone ? ` | ${order.address.phone}` : ""}</p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                <p className="text-sm text-gray-500">{order.invoiceEmailSent ? "E-bill sent to your account email" : "E-bill email not confirmed"}</p>
                <div className="flex flex-wrap gap-2">
                  {order.status === "pending" && (
                    <button className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60" type="button" disabled={cancellingId === order._id} onClick={() => cancelOrder(order)}>
                      {cancellingId === order._id ? "Cancelling..." : "Cancel order"}
                    </button>
                  )}
                  <button className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800" type="button" onClick={() => downloadBill(order)}>
                    Download bill (PDF)
                  </button>
                  {/* The e-bill email presents the order as paid; cancelled and returned ones were refunded. */}
                  {order.status !== "cancelled" && order.status !== "returned" && (
                    <button className="rounded-lg border border-brand-200 px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-60" type="button" disabled={sendingInvoiceId === order._id} onClick={() => resendInvoice(order._id)}>
                      {sendingInvoiceId === order._id ? "Sending..." : "Resend e-bill"}
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

export default OrderHistory;
