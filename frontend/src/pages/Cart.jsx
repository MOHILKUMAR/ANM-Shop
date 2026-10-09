import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CartContext from "../context/CartContext.js";
import { productImage } from "../imageUrl.js";
import { usePageMeta } from "../usePageMeta.js";
import { formatInr } from "../money.js";

// Display only; the server works out the real shipping and total at checkout.
const SHIPPING_FEE = 49;
const FREE_SHIPPING_ABOVE = 499;

function Cart() {
  const { cart, updateQuantity, removeFromCart, refreshCart } = useContext(CartContext);
  const [changes, setChanges] = useState([]);
  usePageMeta({ title: "Your cart", noindex: true });

  // Prices and stock are saved with each item when it is added; show today's instead.
  useEffect(() => {
    let active = true;
    refreshCart()
      .then((notes) => {
        if (active) setChanges(notes);
      })
      .catch(() => {}); // offline: the saved details stay, and checkout re-checks everything
    return () => {
      active = false;
    };
  }, [refreshCart]);
  const total = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

  return (
    <main className="mx-auto min-h-[60vh] max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-brand-700">Your basket</p>
        <h1 className="text-3xl font-bold text-gray-900">Shopping cart</h1>
      </div>

      {changes.length > 0 && (
        <ul className="mb-6 space-y-1 rounded-xl bg-amber-50 p-4 text-sm text-amber-800" role="status">
          {changes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      )}

      {cart.length === 0 ? (
        <div className="rounded-2xl bg-gray-50 p-10 text-center">
          <p className="text-lg text-gray-700">Your cart is empty.</p>
          <Link className="mt-5 inline-block rounded-lg bg-brand-700 px-5 py-3 font-semibold text-white hover:bg-brand-800" to="/shop">Browse products</Link>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
          <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
            {cart.map((item) => (
              <li key={item._id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                <img className="h-24 w-24 rounded-lg bg-gray-50 object-contain" src={productImage(item.imageUrls, 96)} alt={item.name} width="96" height="96" loading="lazy" decoding="async" />
                <div className="min-w-0 flex-1">
                  <Link className="font-semibold text-gray-900 hover:text-brand-700" to={`/product/${item._id}`}>{item.name}</Link>
                  <p className="mt-1 text-sm text-gray-600">{formatInr(item.price)} each</p>
                  <button className="mt-2 text-sm font-medium text-red-600 hover:text-red-800" type="button" onClick={() => removeFromCart(item._id)}>Remove</button>
                </div>
                <div className="flex items-center gap-3">
                  <button className="h-9 w-9 rounded border border-gray-300 text-lg" type="button" aria-label={`Decrease ${item.name} quantity`} onClick={() => updateQuantity(item._id, item.quantity - 1)}>−</button>
                  <span className="min-w-6 text-center" aria-label="Quantity">{item.quantity}</span>
                  <button className="h-9 w-9 rounded border border-gray-300 text-lg disabled:opacity-40" type="button" aria-label={`Increase ${item.name} quantity`} disabled={item.quantity >= Number(item.stock)} onClick={() => updateQuantity(item._id, item.quantity + 1)}>+</button>
                </div>
                <p className="min-w-24 text-right font-semibold text-gray-900">
                  {formatInr(Number(item.price) * item.quantity)}
                </p>
              </li>
            ))}
          </ul>
          <aside className="h-fit rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">Order summary</h2>
            <div className="mt-5 flex justify-between border-t border-gray-200 pt-4 font-semibold text-gray-900">
              <span>Subtotal</span>
              <span>{formatInr(total)}</span>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {total >= FREE_SHIPPING_ABOVE
                ? "Your order ships free."
                : `Add ${formatInr(FREE_SHIPPING_ABOVE - total)} more for free shipping, or pay ${formatInr(SHIPPING_FEE)} at checkout.`}
            </p>
            <p className="mt-1 text-xs text-gray-500">Apply a coupon at checkout.</p>
            <Link className="mt-6 block rounded-lg bg-brand-700 px-5 py-3 text-center font-semibold text-white hover:bg-brand-800" to="/checkout">Proceed to checkout</Link>
            <Link className="mt-4 block text-center text-sm font-medium text-brand-700 hover:text-brand-900" to="/shop">Continue shopping</Link>
          </aside>
        </div>
      )}
    </main>
  );
}

export default Cart;
