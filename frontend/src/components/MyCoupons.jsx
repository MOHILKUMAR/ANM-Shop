import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api.js";
import { ListSkeleton } from "./Skeletons.jsx";

const money = (amount) => Number(amount || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" });
const day = (date) => new Date(date).toLocaleDateString("en-IN", { dateStyle: "medium" });
const methodLabels = { upi: "UPI", card: "card", netbanking: "net banking", wallet: "wallet" };

// The conditions under a coupon, in the order a customer would ask about them.
function conditions(coupon) {
  const lines = [];
  if (coupon.minCartValue > 0) lines.push(`Minimum order ${money(coupon.minCartValue)}`);
  if (coupon.categories?.length) lines.push(`On ${coupon.categories.join(", ")}`);
  if (coupon.products?.length) lines.push(`On ${coupon.products.slice(0, 3).join(", ")}${coupon.products.length > 3 ? ` and ${coupon.products.length - 3} more` : ""}`);
  if (coupon.paymentMethods?.length) lines.push(`Pay by ${coupon.paymentMethods.map((method) => methodLabels[method] || method).join(" or ")}`);
  if (coupon.usesLeft !== null) lines.push(`${coupon.usesLeft} use${coupon.usesLeft === 1 ? "" : "s"} left for you`);
  if (coupon.expiresAt) lines.push(`Valid until ${day(coupon.expiresAt)}`);
  return lines;
}

function MyCoupons({ token }) {
  const [coupons, setCoupons] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest("/coupons/mine", { token })
      .then((result) => {
        if (active) setCoupons(Array.isArray(result) ? result : []);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function copy(code) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setCopied(""); // clipboard blocked; the code is on screen to type
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-900">My coupons{coupons ? ` (${coupons.length})` : ""}</h2>
        <Link className="text-sm font-semibold text-brand-700 hover:text-brand-900" to="/shop">Browse products</Link>
      </div>
      <p className="mt-1 text-sm text-gray-600">Apply a code in the order summary at checkout. One coupon per order.</p>

      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      {!coupons && !error && <div className="mt-4"><ListSkeleton rows={2} label="Loading your coupons" /></div>}
      {coupons?.length === 0 && <p className="mt-4 rounded-lg bg-gray-50 p-5 text-sm text-gray-600">No coupons available right now. Check back soon.</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {coupons?.map((coupon) => (
          <article className="flex flex-col justify-between rounded-xl border border-dashed border-brand-300 bg-brand-50 p-4" key={coupon.code}>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-base font-bold text-brand-900">{coupon.code}</p>
                {coupon.personal && <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-brand-800">For you</span>}
              </div>
              <p className="mt-1 font-semibold text-gray-900">{coupon.summary}</p>
              {coupon.description && <p className="mt-1 text-sm text-gray-700">{coupon.description}</p>}
              <ul className="mt-2 space-y-0.5 text-xs text-gray-600">
                {conditions(coupon).map((line) => <li key={line}>{line}</li>)}
              </ul>
            </div>
            <button className="mt-3 rounded-lg border border-brand-600 bg-white px-3 py-1.5 text-sm font-semibold text-brand-800 hover:bg-brand-50" type="button" onClick={() => copy(coupon.code)}>
              {copied === coupon.code ? "Copied" : "Copy code"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

export default MyCoupons;
