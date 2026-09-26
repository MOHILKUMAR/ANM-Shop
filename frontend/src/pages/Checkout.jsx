import { useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../api.js";
import AuthContext from "../context/AuthContext.js";
import CartContext from "../context/CartContext.js";

function Checkout() {
  const { user } = useContext(AuthContext);
  const { cart, clearCart } = useContext(CartContext);
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

  const total = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

  function updateAddress(event) {
    const { name, value } = event.target;
    setAddress((current) => ({ ...current, [name]: value }));
  }

  async function startPayment(event) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      const paymentOrder = await apiRequest("/payment/order", {
        method: "POST",
        token: user.token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((item) => ({ productId: item._id, qty: item.quantity })),
          address,
        }),
      });

      const checkout = new window.Razorpay({
        key: paymentOrder.keyId,
        amount: paymentOrder.amount,
        currency: paymentOrder.currency,
        name: "ANM-Shop",
        description: "Secure order payment",
        order_id: paymentOrder.razorpayOrderId,
        prefill: { name: user.name, email: user.email },
        theme: { color: "#754656" },
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
              // Item sold out mid-payment: the server has refunded (or queued a manual refund).
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
      setError(requestError.message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-[60vh] max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-brand-700">Almost yours</p>
      <h1 className="mb-8 text-3xl font-bold text-gray-900">Delivery and payment</h1>
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
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
                <input className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" id={field} name={field} type={type} autoComplete={autocomplete} placeholder={field === "phone" ? "+91 98765 43210" : undefined} maxLength={field === "phone" ? 20 : undefined} pattern={field === "phone" ? "\\+?[1-9][0-9\\s()-]{6,17}" : undefined} required value={address[field]} onChange={updateAddress} />
              </div>
            ))}
          </div>
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
          <button className="w-full rounded-lg bg-brand-700 px-5 py-3 font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={busy || !sdkReady}>
            {!sdkReady ? "Loading secure payment…" : busy ? "Waiting for payment…" : "Pay securely"}
          </button>
          <p className="text-center text-xs text-gray-500">Final price and stock are checked by the server before payment.</p>
        </form>

        <aside className="h-fit rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">Order summary</h2>
          <ul className="mt-4 space-y-3">
            {cart.map((item) => (
              <li className="flex justify-between gap-3 text-sm" key={item._id}>
                <span className="text-gray-600">{item.name} × {item.quantity}</span>
                <span className="font-medium text-gray-900">{(Number(item.price) * item.quantity).toLocaleString("en-IN", { style: "currency", currency: "INR" })}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex justify-between border-t border-gray-200 pt-4 font-bold text-gray-900">
            <span>Estimated total</span>
            <span>{total.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</span>
          </div>
          <p className="mt-3 text-xs text-gray-500">The server calculates the actual charge using current product prices.</p>
        </aside>
      </div>
    </main>
  );
}

export default Checkout;
