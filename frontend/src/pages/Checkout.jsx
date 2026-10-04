import { useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../api.js";
import AuthContext from "../context/AuthContext.js";
import CartContext from "../context/CartContext.js";
import { Shimmer } from "../components/Skeletons.jsx";

const money = (amount) => Number(amount || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" });
const methodLabels = { upi: "UPI", card: "Card", netbanking: "Net banking", wallet: "Wallet" };
// Same rule as the server: 8 to 15 digits once spaces, brackets, and dashes are removed.
const isValidPhone = (phone) => /^\+?[1-9]\d{7,14}$/.test(phone.replace(/[\s()-]/g, ""));
const PHONE_HINT = "Enter a valid mobile number with 8 to 15 digits, e.g. +91 98765 43210.";
// Identifies one price check, so the page knows whether the quote on screen is for what's shown.
const quoteKeyOf = (itemsKey, couponCode, attempt) => JSON.stringify([itemsKey, couponCode, attempt]);

// Razorpay Checkout only shows the payment methods a coupon allows.
const methodRestriction = (methods) => (methods?.length ? {
  config: {
    display: {
      blocks: { coupon: { name: `Pay with ${methods.map((method) => methodLabels[method]).join(" or ")}`, instruments: methods.map((method) => ({ method })) } },
      sequence: ["block.coupon"],
      preferences: { show_default_blocks: false },
    },
  },
} : {});

function Checkout() {
  const { user } = useContext(AuthContext);
  const { cart, clearCart, refreshCart } = useContext(CartContext);
  const navigate = useNavigate();
  const [sdkReady, setSdkReady] = useState(Boolean(window.Razorpay));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [address, setAddress] = useState({
    fullName: user?.name || "",
    street: "",
    city: "",
    postalCode: "",
    country: "India",
    phone: "",
  });
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState("");
  // The price check the current quote or error came from, and a counter for "Try again".
  const [quotedKey, setQuotedKey] = useState("");
  const [quoteAttempt, setQuoteAttempt] = useState(0);
  const [cartChanges, setCartChanges] = useState([]);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCode, setAppliedCode] = useState("");
  const [couponMessage, setCouponMessage] = useState("");
  const [myCoupons, setMyCoupons] = useState([]);
  const items = cart.map((item) => ({ productId: item._id, qty: item.quantity }));
  const itemsKey = JSON.stringify(items);

  useEffect(() => {
    if (!user || cart.length === 0) return undefined;
    if (window.Razorpay) return undefined;

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => setSdkReady(true);
    script.onerror = () => setError("Unable to load the payment service. Check your connection and retry.");
    document.body.appendChild(script);
    return () => script.remove();
  }, [user, cart.length]);

  // Prices and stock are saved with each item when it is added; bring them up to date first.
  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    refreshCart()
      .then((notes) => {
        if (active) setCartChanges(notes);
      })
      .catch(() => {}); // the quote below still prices everything on the server
    return () => {
      active = false;
    };
  }, [user, refreshCart]);

  // The server prices the cart (shipping and coupon included) whenever it or the coupon changes.
  useEffect(() => {
    if (!user?.token || itemsKey === "[]") return undefined;
    let active = true;
    const requestKey = quoteKeyOf(itemsKey, appliedCode, quoteAttempt);
    apiRequest("/payment/quote", {
      method: "POST",
      token: user.token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: JSON.parse(itemsKey), couponCode: appliedCode || undefined }),
    })
      .then((result) => {
        if (!active) return;
        setQuote(result);
        setQuoteError("");
        setQuotedKey(requestKey);
        if (result.couponError) {
          setCouponMessage(result.couponError);
          setAppliedCode("");
        }
      })
      .catch((requestError) => {
        if (!active) return;
        setQuoteError(requestError.message);
        setQuotedKey(requestKey);
        if (appliedCode) {
          // Let the customer apply it again instead of leaving the box stuck on "Checking…".
          setCouponMessage(`Coupon ${appliedCode} couldn't be checked. Apply it again.`);
          setAppliedCode("");
        }
        if (requestError.data?.unavailableProductIds) {
          refreshCart()
            .then((notes) => {
              if (active) setCartChanges(notes);
            })
            .catch(() => {});
        }
      });
    return () => {
      active = false;
    };
  }, [user?.token, itemsKey, appliedCode, quoteAttempt, refreshCart]);

  useEffect(() => {
    if (!user?.token) return undefined;
    let active = true;
    apiRequest("/coupons/mine", { token: user.token })
      .then((result) => {
        if (active) setMyCoupons(Array.isArray(result) ? result : []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.token]);

  if (!user) {
    return (
      <main className="mx-auto min-h-[60vh] max-w-3xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Sign in to check out</h1>
        <p className="mt-3 text-gray-600">Your cart will be here when you return.</p>
        <Link className="mt-6 inline-block rounded-lg bg-brand-700 px-5 py-3 font-semibold text-white hover:bg-brand-800" to="/login" state={{ from: "/checkout" }}>Sign in</Link>
      </main>
    );
  }

  if (cart.length === 0) {
    return (
      <main className="mx-auto min-h-[60vh] max-w-3xl px-4 py-16 text-center">
        {cartChanges.length > 0 && !error && (
          <ul className="mb-6 space-y-1 rounded-xl bg-amber-50 p-4 text-left text-sm text-amber-800" role="status">
            {cartChanges.map((note) => <li key={note}>{note}</li>)}
          </ul>
        )}
        {error ? (
          <>
            <h1 className="text-3xl font-bold text-gray-900">About your payment</h1>
            <p className="mt-4 rounded-lg bg-amber-50 p-4 text-left text-amber-900" role="alert">{error}</p>
            <Link className="mt-6 inline-block font-semibold text-brand-700" to="/orders">Go to Order History</Link>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold text-gray-900">Your cart is empty</h1>
            <Link className="mt-6 inline-block font-semibold text-brand-700" to="/shop">Browse products</Link>
          </>
        )}
      </main>
    );
  }

  const coupon = quote?.coupon;
  // True while the price for the current cart and coupon is still being worked out.
  const quoting = quotedKey !== quoteKeyOf(itemsKey, appliedCode, quoteAttempt);
  const pricingReady = Boolean(quote) && !quoteError && !quoting;

  function updateAddress(event) {
    const { name, value } = event.target;
    setAddress((current) => ({ ...current, [name]: value }));
  }

  function applyCoupon(code) {
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    setCouponMessage("");
    setCouponInput(clean);
    setAppliedCode(clean);
  }

  function removeCoupon() {
    setAppliedCode("");
    setCouponInput("");
    setCouponMessage("");
  }

  async function startPayment(event) {
    event.preventDefault();
    setError("");
    if (!isValidPhone(address.phone)) {
      setError(PHONE_HINT);
      return;
    }
    setBusy(true);

    try {
      const paymentOrder = await apiRequest("/payment/order", {
        method: "POST",
        token: user.token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, address, couponCode: coupon?.code }),
      });

      const checkout = new window.Razorpay({
        key: paymentOrder.keyId,
        amount: paymentOrder.amount,
        currency: paymentOrder.currency,
        name: "ANM-Shop",
        description: coupon ? `Order with coupon ${coupon.code}` : "Secure order payment",
        order_id: paymentOrder.razorpayOrderId,
        prefill: { name: user.name, email: user.email },
        theme: { color: "#754656" },
        ...methodRestriction(paymentOrder.allowedPaymentMethods),
        modal: { ondismiss: () => setBusy(false) },
        handler: async (paymentResponse) => {
          try {
            const verification = await apiRequest("/payment/verify", {
              method: "POST",
              token: user.token,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(paymentResponse),
            });
            clearCart();
            if (verification?.pending) {
              // Paid but Razorpay is still capturing; the webhook will create the order.
              setError(verification.message);
              setBusy(false);
              return;
            }
            navigate("/orders", { replace: true });
          } catch (verificationError) {
            const { status, data } = verificationError;
            if (status === 409 && data && "refunded" in data) {
              // The order couldn't be completed (sold out, coupon limit); the server has refunded.
              clearCart();
              setError(verificationError.message);
            } else if (status === 0 || status >= 500) {
              // Money was taken but we couldn't confirm. The Razorpay webhook will still
              // create the order, so don't invite the customer to pay a second time.
              clearCart();
              setError(
                `Your payment (${paymentResponse.razorpay_payment_id}) was received but we couldn't confirm it yet. ` +
                "Your order will appear in Order History within a few minutes — please don't pay again.",
              );
            } else {
              setError(verificationError.message);
            }
            setBusy(false);
          }
        },
      });
      checkout.open();
    } catch (requestError) {
      if (requestError.data?.couponError) {
        // The coupon stopped being valid; show the new price before charging anything.
        setCouponMessage(requestError.message);
        setAppliedCode("");
      } else if (requestError.data?.unavailableProductIds) {
        // Not a payment problem: nothing was charged. Update the cart and say what changed.
        setCartChanges([requestError.message]);
        refreshCart()
          .then((notes) => setCartChanges(notes.length ? notes : [requestError.message]))
          .catch(() => {});
      } else {
        setError(requestError.message);
      }
      setBusy(false);
    }
  }

  const suggestions = myCoupons.filter((item) => item.code !== coupon?.code).slice(0, 4);
  const freeShippingGap = quote && quote.shipping > 0 ? quote.freeShippingAbove - quote.subtotal : 0;

  return (
    <main className="mx-auto min-h-[60vh] max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-brand-700">Almost yours</p>
      <h1 className="mb-8 text-3xl font-bold text-gray-900">Delivery and payment</h1>
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <form className="space-y-6 rounded-xl border border-gray-200 bg-white p-6" onSubmit={startPayment}>
          <h2 className="text-xl font-semibold text-gray-900">Shipping address</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["fullName", "Full name", "text", "name"],
              ["street", "Street address", "text", "street-address"],
              ["city", "City", "text", "address-level2"],
              ["postalCode", "Postal code", "text", "postal-code"],
              ["country", "Country", "text", "country-name"],
              ["phone", "Mobile number", "tel", "tel"],
            ].map(([field, label, type, autocomplete]) => (
              <div className={field === "street" ? "sm:col-span-2" : ""} key={field}>
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor={field}>{label}</label>
                <input className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" id={field} name={field} type={type} autoComplete={autocomplete} placeholder={field === "phone" ? "+91 98765 43210" : undefined} maxLength={field === "phone" ? 20 : undefined} required value={address[field]} onChange={updateAddress} />
              </div>
            ))}
          </div>
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
          {quoteError && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
              <p>{quoteError}</p>
              <button className="rounded-md border border-red-300 px-3 py-1 font-semibold hover:bg-red-100 disabled:opacity-50" type="button" disabled={quoting} onClick={() => setQuoteAttempt((attempt) => attempt + 1)}>
                {quoting ? "Checking…" : "Try again"}
              </button>
            </div>
          )}
          {coupon?.paymentMethods?.length > 0 && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Coupon {coupon.code} works with {coupon.paymentMethods.map((method) => methodLabels[method]).join(" or ")} only; the payment window will show just those options.
            </p>
          )}
          <button className="w-full rounded-lg bg-brand-700 px-5 py-3 font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={busy || !sdkReady || !pricingReady}>
            {!sdkReady ? "Loading secure payment…" : busy ? "Waiting for payment…" : pricingReady ? `Pay ${money(quote.total)} securely` : "Pay securely"}
          </button>
          <p className="text-center text-xs text-gray-500">Prices, stock, and coupons are checked by the server before payment.</p>
        </form>

        <aside className="h-fit space-y-5 rounded-xl border border-gray-200 bg-white p-6">
          {cartChanges.length > 0 && (
            <ul className="space-y-1 rounded-lg bg-amber-50 p-3 text-sm text-amber-800" role="status">
              {cartChanges.map((note) => <li key={note}>{note}</li>)}
            </ul>
          )}
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Order summary</h2>
            <ul className="mt-4 space-y-3">
              {cart.map((item) => (
                <li className="flex justify-between gap-3 text-sm" key={item._id}>
                  <span className="text-gray-600">{item.name} × {item.quantity}</span>
                  <span className="font-medium text-gray-900">{money(Number(item.price) * item.quantity)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="coupon-code">Coupon</label>
            {coupon ? (
              <div className="flex items-start justify-between gap-3 rounded-lg border border-green-200 bg-green-50 p-3">
                <div>
                  <p className="font-mono text-sm font-semibold text-green-800">{coupon.code}</p>
                  <p className="text-xs text-green-800">{coupon.summary}{coupon.description ? ` · ${coupon.description}` : ""}</p>
                </div>
                <button className="text-sm font-semibold text-red-600 hover:text-red-800" type="button" onClick={removeCoupon}>Remove</button>
              </div>
            ) : (
              <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); applyCoupon(couponInput); }}>
                <input id="coupon-code" className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm uppercase outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" maxLength={30} placeholder="Enter code" value={couponInput} onChange={(event) => setCouponInput(event.target.value)} />
                <button className="rounded-lg border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-50" type="submit" disabled={!couponInput.trim() || (quoting && appliedCode !== "")}>
                  {quoting && appliedCode ? "Checking…" : "Apply"}
                </button>
              </form>
            )}
            {couponMessage && <p className="mt-2 text-sm text-red-700" role="alert">{couponMessage}</p>}
            {!coupon && suggestions.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-gray-500">Your coupons</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {suggestions.map((item) => (
                    <button className="rounded-full border border-dashed border-brand-300 px-3 py-1 text-xs font-medium text-brand-800 hover:bg-brand-50" type="button" key={item.code} title={item.description || item.summary} onClick={() => applyCoupon(item.code)}>
                      {item.code} · {item.summary}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <dl className="space-y-2 border-t border-gray-200 pt-4 text-sm">
            {pricingReady ? (
              <>
                <div className="flex justify-between"><dt className="text-gray-600">Subtotal</dt><dd className="text-gray-900">{money(quote.subtotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-600">Shipping</dt><dd className="text-gray-900">{quote.shipping ? money(quote.shipping) : "Free"}</dd></div>
                {quote.discount > 0 && <div className="flex justify-between text-green-700"><dt>Discount ({coupon?.code})</dt><dd>−{money(quote.discount)}</dd></div>}
                <div className="flex justify-between border-t border-gray-200 pt-3 text-base font-bold text-gray-900"><dt>Total</dt><dd>{money(quote.total)}</dd></div>
                {quote.savings > 0 && <p className="text-xs font-medium text-green-700">You save {money(quote.savings)} with {coupon?.code}.</p>}
                {freeShippingGap > 0 && <p className="text-xs text-gray-500">Add {money(freeShippingGap)} more for free shipping.</p>}
              </>
            ) : (
              <div className="space-y-2" role="status" aria-label="Calculating total">
                <Shimmer className="h-4 w-full" />
                <Shimmer className="h-4 w-full" />
                <Shimmer className="h-6 w-full" />
              </div>
            )}
          </dl>
        </aside>
      </div>
    </main>
  );
}

export default Checkout;
