import { useEffect, useState } from "react";
import { apiRequest } from "../api.js";
import { ListSkeleton } from "./Skeletons.jsx";
import { beautyCategories } from "../data/beautyCategories.js";
import { formatInr } from "../money.js";

const day = (date) => (date ? new Date(date).toLocaleDateString("en-IN", { dateStyle: "medium" }) : null);
const inputClass = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

const discountTypes = [
  ["percentage", "Percentage off"],
  ["fixed", "Fixed amount off"],
  ["free_shipping", "Free shipping"],
  ["buy_x_get_y", "Buy X get Y free"],
];
const paymentMethods = [["upi", "UPI"], ["card", "Card"], ["netbanking", "Net banking"], ["wallet", "Wallet"]];
const statusStyles = {
  active: ["Active", "bg-green-50 text-green-800"],
  scheduled: ["Scheduled", "bg-brand-50 text-brand-800"],
  expired: ["Expired", "bg-gray-100 text-gray-700"],
  used_up: ["Fully used", "bg-amber-50 text-amber-800"],
  disabled: ["Disabled", "bg-gray-100 text-gray-700"],
};

const emptyForm = {
  code: "", description: "", discountType: "percentage", discountValue: "", buyQuantity: "2", getQuantity: "1",
  minCartValue: "", maxDiscount: "", startsAt: "", expiresAt: "", usageLimit: "", perUserLimit: "",
  applicableProducts: [], applicableCategories: [], applicableUserEmails: "", paymentMethods: [],
  isActive: true, showToCustomers: true,
};

// <input type="datetime-local"> needs a local "YYYY-MM-DDTHH:mm" value.
const toLocalInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const toForm = (coupon) => ({
  ...emptyForm,
  ...coupon,
  discountValue: coupon.discountValue || "",
  buyQuantity: coupon.buyQuantity || "2",
  getQuantity: coupon.getQuantity || "1",
  minCartValue: coupon.minCartValue || "",
  maxDiscount: coupon.maxDiscount ?? "",
  usageLimit: coupon.usageLimit ?? "",
  perUserLimit: coupon.perUserLimit ?? "",
  startsAt: toLocalInput(coupon.startsAt),
  expiresAt: toLocalInput(coupon.expiresAt),
  applicableProducts: (coupon.applicableProducts || []).map((product) => product._id),
  applicableUserEmails: (coupon.applicableUserEmails || []).join(", "),
});

function Toggle({ id, label, hint, checked, onChange }) {
  return (
    <label className="flex items-start gap-2 text-sm text-gray-700" htmlFor={id}>
      <input id={id} type="checkbox" className="mt-1" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}{hint && <span className="block text-xs text-gray-500">{hint}</span>}</span>
    </label>
  );
}

function Field({ label, htmlFor, hint, children, className = "" }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function AdminCoupons({ token }) {
  const [coupons, setCoupons] = useState(null);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest("/coupons", { token }),
      apiRequest("/products/manage?limit=100", { token }).then((result) => result.items || []).catch(() => []),
    ])
      .then(([couponList, productList]) => {
        if (!active) return;
        setCoupons(couponList);
        setProducts(productList);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const update = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));
  const toggleIn = (field, value) => setForm((current) => ({
    ...current,
    [field]: current[field].includes(value) ? current[field].filter((item) => item !== value) : [...current[field], value],
  }));

  function startEditing(coupon) {
    setEditingId(coupon._id);
    setForm(toForm(coupon));
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditing() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  }

  async function save(event) {
    event.preventDefault();
    // Same rule as the server, so the admin hears about it before saving.
    if (!/^[A-Z0-9_-]{3,30}$/.test(form.code.trim())) {
      setError("The code must be 3 to 30 letters, numbers, dashes, or underscores (no spaces).");
      return;
    }
    if (form.expiresAt && form.startsAt && new Date(form.expiresAt) <= new Date(form.startsAt)) {
      setError("The expiry must be after the start.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    const payload = {
      ...form,
      applicableUserEmails: form.applicableUserEmails.split(/[\s,;]+/).filter(Boolean),
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : "",
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : "",
    };
    try {
      const saved = await apiRequest(editingId ? `/coupons/${editingId}` : "/coupons", {
        method: editingId ? "PUT" : "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setCoupons((current) => (editingId
        ? current.map((coupon) => (coupon._id === saved._id ? saved : coupon))
        : [saved, ...current]));
      setNotice(editingId ? `Coupon ${saved.code} updated.` : `Coupon ${saved.code} created.`);
      cancelEditing();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(coupon) {
    if (!window.confirm(`Delete coupon ${coupon.code}?\n\nCustomers can no longer use it. Orders already placed with it keep their discount.`)) return;
    setError("");
    try {
      const result = await apiRequest(`/coupons/${coupon._id}`, { method: "DELETE", token });
      setCoupons((current) => current.filter((item) => item._id !== coupon._id));
      if (editingId === coupon._id) cancelEditing();
      setNotice(result.message);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  // Changes only the on/off switch; resending the whole form would resend the dates too.
  async function toggleActive(coupon) {
    setError("");
    try {
      const saved = await apiRequest(`/coupons/${coupon._id}/active`, {
        method: "PATCH",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !coupon.isActive }),
      });
      setCoupons((current) => current.map((item) => (item._id === saved._id ? saved : item)));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  const isPercentage = form.discountType === "percentage";
  const isFixed = form.discountType === "fixed";
  const isBuyXGetY = form.discountType === "buy_x_get_y";

  return (
    <section className="grid gap-8 lg:grid-cols-[24rem_1fr]">
      <form className="h-fit space-y-4 rounded-xl border border-gray-200 bg-white p-5" onSubmit={save}>
        <h2 className="text-lg font-semibold text-gray-900">{editingId ? "Edit coupon" : "Create a coupon"}</h2>

        <Field label="Code" htmlFor="coupon-code" hint="Customers type this at checkout.">
          <input id="coupon-code" className={`${inputClass} font-mono uppercase`} required maxLength={30} placeholder="DIWALI20" value={form.code} onChange={(event) => update("code")(event.target.value.toUpperCase())} />
        </Field>
        <Field label="Description" htmlFor="coupon-description" hint="Shown to customers. Optional.">
          <input id="coupon-description" className={inputClass} maxLength={200} placeholder="Festive offer on all skincare" value={form.description} onChange={(event) => update("description")(event.target.value)} />
        </Field>
        <Field label="Discount type" htmlFor="coupon-type">
          <select id="coupon-type" className={`${inputClass} bg-white`} value={form.discountType} onChange={(event) => update("discountType")(event.target.value)}>
            {discountTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>

        {(isPercentage || isFixed) && (
          <Field label={isPercentage ? "Percentage off" : "Amount off (₹)"} htmlFor="coupon-value">
            <input id="coupon-value" className={inputClass} type="number" min={isPercentage ? 1 : 1} max={isPercentage ? 100 : undefined} step={isPercentage ? 1 : 0.01} required value={form.discountValue} onChange={(event) => update("discountValue")(event.target.value)} />
          </Field>
        )}
        {isBuyXGetY && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Buy quantity" htmlFor="coupon-buy"><input id="coupon-buy" className={inputClass} type="number" min={1} max={20} required value={form.buyQuantity} onChange={(event) => update("buyQuantity")(event.target.value)} /></Field>
            <Field label="Free quantity" htmlFor="coupon-get" hint="The cheapest qualifying items are free."><input id="coupon-get" className={inputClass} type="number" min={1} max={20} required value={form.getQuantity} onChange={(event) => update("getQuantity")(event.target.value)} /></Field>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Minimum cart (₹)" htmlFor="coupon-min" hint="0 for none."><input id="coupon-min" className={inputClass} type="number" min={0} step={0.01} value={form.minCartValue} onChange={(event) => update("minCartValue")(event.target.value)} /></Field>
          {!isFixed && form.discountType !== "free_shipping" && (
            <Field label="Max discount (₹)" htmlFor="coupon-max" hint="Blank for no cap."><input id="coupon-max" className={inputClass} type="number" min={1} step={0.01} value={form.maxDiscount} onChange={(event) => update("maxDiscount")(event.target.value)} /></Field>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts" htmlFor="coupon-start" hint="Blank means now."><input id="coupon-start" className={inputClass} type="datetime-local" value={form.startsAt} onChange={(event) => update("startsAt")(event.target.value)} /></Field>
          <Field label="Expires" htmlFor="coupon-expiry" hint="Blank means never."><input id="coupon-expiry" className={inputClass} type="datetime-local" value={form.expiresAt} onChange={(event) => update("expiresAt")(event.target.value)} /></Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Total uses" htmlFor="coupon-limit" hint="Blank for unlimited."><input id="coupon-limit" className={inputClass} type="number" min={1} value={form.usageLimit} onChange={(event) => update("usageLimit")(event.target.value)} /></Field>
          <Field label="Uses per customer" htmlFor="coupon-per-user" hint="Blank for unlimited."><input id="coupon-per-user" className={inputClass} type="number" min={1} value={form.perUserLimit} onChange={(event) => update("perUserLimit")(event.target.value)} /></Field>
        </div>

        <fieldset>
          <legend className="mb-1 text-sm font-medium text-gray-700">Applicable categories</legend>
          <p className="mb-2 text-xs text-gray-500">None selected means all products.</p>
          <div className="flex flex-wrap gap-2">
            {beautyCategories.map((category) => (
              <button className={`rounded-full border px-3 py-1 text-xs font-medium ${form.applicableCategories.includes(category.name) ? "border-brand-600 bg-brand-50 text-brand-800" : "border-gray-300 text-gray-600"}`} type="button" key={category.name} aria-pressed={form.applicableCategories.includes(category.name)} onClick={() => toggleIn("applicableCategories", category.name)}>
                {category.name}
              </button>
            ))}
          </div>
        </fieldset>

        <Field label="Applicable products" htmlFor="coupon-products" hint="Optional. Ctrl/Cmd-click to select several.">
          <select id="coupon-products" className={`${inputClass} bg-white`} multiple size={4} value={form.applicableProducts} onChange={(event) => update("applicableProducts")([...event.target.selectedOptions].map((option) => option.value))}>
            {products.map((product) => <option key={product._id} value={product._id}>{product.name}</option>)}
          </select>
        </Field>

        <Field label="Applicable customers" htmlFor="coupon-users" hint="Email addresses, comma separated. Blank means everyone.">
          <textarea id="coupon-users" className={inputClass} rows={2} placeholder="priya@example.com, ravi@example.com" value={form.applicableUserEmails} onChange={(event) => update("applicableUserEmails")(event.target.value)} />
        </Field>

        <fieldset>
          <legend className="mb-1 text-sm font-medium text-gray-700">Payment methods</legend>
          <p className="mb-2 text-xs text-gray-500">None selected means any method.</p>
          <div className="flex flex-wrap gap-2">
            {paymentMethods.map(([value, label]) => (
              <button className={`rounded-full border px-3 py-1 text-xs font-medium ${form.paymentMethods.includes(value) ? "border-brand-600 bg-brand-50 text-brand-800" : "border-gray-300 text-gray-600"}`} type="button" key={value} aria-pressed={form.paymentMethods.includes(value)} onClick={() => toggleIn("paymentMethods", value)}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="space-y-2 border-t border-gray-100 pt-3">
          <Toggle id="coupon-active" label="Active" hint="Turn off to pause the coupon without deleting it." checked={form.isActive} onChange={update("isActive")} />
          <Toggle id="coupon-visible" label="Show in customers' My coupons" hint="Turn off for secret codes that still work when typed." checked={form.showToCustomers} onChange={update("showToCustomers")} />
        </div>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
        <button className="w-full rounded-lg bg-brand-700 px-4 py-2.5 font-semibold text-white hover:bg-brand-800 disabled:opacity-60" type="submit" disabled={busy}>
          {busy ? "Saving…" : editingId ? "Save changes" : "Create coupon"}
        </button>
        {editingId && <button className="w-full rounded-lg border border-gray-300 px-4 py-2.5 font-semibold text-gray-700 hover:bg-gray-50" type="button" onClick={cancelEditing}>Cancel edit</button>}
      </form>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Coupons{coupons ? ` (${coupons.length})` : ""}</h2>
        {notice && <p className="rounded-lg bg-green-50 p-4 text-green-800" role="status">{notice}</p>}
        {!coupons && !error && <ListSkeleton rows={4} label="Loading coupons" />}
        {coupons?.length === 0 && <p className="rounded-xl bg-gray-50 p-6 text-gray-600">No coupons yet. Create one with the form.</p>}
        {coupons?.map((coupon) => {
          const [statusLabel, statusClass] = statusStyles[coupon.status] || [coupon.status, "bg-gray-100 text-gray-700"];
          return (
            <article className="rounded-xl border border-gray-200 bg-white p-5" key={coupon._id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-base font-bold text-gray-900">{coupon.code}</p>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>{statusLabel}</span>
                    {!coupon.showToCustomers && <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">Hidden</span>}
                  </div>
                  <p className="mt-1 font-medium text-gray-900">{coupon.summary}</p>
                  {coupon.description && <p className="text-sm text-gray-600">{coupon.description}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button className="rounded-lg px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50" type="button" onClick={() => toggleActive(coupon)}>{coupon.isActive ? "Pause" : "Resume"}</button>
                  <button className="rounded-lg px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50" type="button" onClick={() => startEditing(coupon)}>Edit</button>
                  <button className="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50" type="button" onClick={() => remove(coupon)}>Delete</button>
                </div>
              </div>
              <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex gap-2"><dt className="text-gray-500">Used</dt><dd className="text-gray-900">{coupon.usedCount}{coupon.usageLimit ? ` of ${coupon.usageLimit}` : ""}{coupon.perUserLimit ? ` · max ${coupon.perUserLimit} per customer` : ""}</dd></div>
                {coupon.minCartValue > 0 && <div className="flex gap-2"><dt className="text-gray-500">Min cart</dt><dd className="text-gray-900">{formatInr(coupon.minCartValue)}</dd></div>}
                {coupon.maxDiscount && <div className="flex gap-2"><dt className="text-gray-500">Max discount</dt><dd className="text-gray-900">{formatInr(coupon.maxDiscount)}</dd></div>}
                <div className="flex gap-2"><dt className="text-gray-500">Runs</dt><dd className="text-gray-900">{day(coupon.startsAt)} → {day(coupon.expiresAt) || "no end"}</dd></div>
                {coupon.applicableCategories?.length > 0 && <div className="flex gap-2"><dt className="text-gray-500">Categories</dt><dd className="text-gray-900">{coupon.applicableCategories.join(", ")}</dd></div>}
                {coupon.applicableProducts?.length > 0 && <div className="flex gap-2"><dt className="text-gray-500">Products</dt><dd className="text-gray-900">{coupon.applicableProducts.map((product) => product.name).join(", ")}</dd></div>}
                {coupon.applicableUserEmails?.length > 0 && <div className="flex gap-2"><dt className="text-gray-500">Customers</dt><dd className="break-all text-gray-900">{coupon.applicableUserEmails.join(", ")}</dd></div>}
                {coupon.paymentMethods?.length > 0 && <div className="flex gap-2"><dt className="text-gray-500">Payment</dt><dd className="text-gray-900">{coupon.paymentMethods.map((method) => paymentMethods.find(([value]) => value === method)?.[1] || method).join(", ")}</dd></div>}
              </dl>
            </article>
          );
        })}
      </section>
    </section>
  );
}

export default AdminCoupons;
