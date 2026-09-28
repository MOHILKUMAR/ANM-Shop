import { useContext, useEffect, useState } from "react";
import AuthContext from "./AuthContext.js";
import CartContext from "./CartContext.js";

// Each account keeps its own cart on this device; signed-out visitors share a guest cart.
// (Before this, every account on a device shared one "shopnestCart" key, so the next person
// to sign in saw the previous person's cart.)
const GUEST = "guest";
const LEGACY_KEY = "shopnestCart";
const storageKey = (owner) => `shopnestCart:${owner}`;

function readCart(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function writeCart(key, cart) {
  try {
    if (cart.length) localStorage.setItem(key, JSON.stringify(cart));
    else localStorage.removeItem(key);
  } catch {
    // Storage unavailable (private mode): the cart still works for this visit.
  }
}

// Adds `extra` items into `cart`, summing quantities and staying within stock.
function mergeCarts(cart, extra) {
  const merged = cart.map((item) => ({ ...item }));
  for (const item of extra) {
    const existing = merged.find((entry) => entry._id === item._id);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + item.quantity, Number(existing.stock) || 99, 99);
    } else {
      merged.push({ ...item });
    }
  }
  return merged;
}

// The starting cart for `owner`. Signing in moves anything added while signed out into the
// account's cart. The old shared cart goes to whoever is signed in now; with nobody signed
// in, its owner is unknown, so it is dropped rather than handed to the next person.
// Safe to run more than once: the guest and legacy carts are emptied after being moved.
function loadCart(owner) {
  const legacy = readCart(LEGACY_KEY);
  writeCart(LEGACY_KEY, []);
  if (owner === GUEST) return readCart(storageKey(GUEST));

  const cart = mergeCarts(mergeCarts(readCart(storageKey(owner)), legacy), readCart(storageKey(GUEST)));
  writeCart(storageKey(GUEST), []);
  writeCart(storageKey(owner), cart);
  return cart;
}

export function CartProvider({ children }) {
  const { user } = useContext(AuthContext);
  const owner = user?._id ? String(user._id) : GUEST;
  const [cartOwner, setCartOwner] = useState(owner);
  const [cart, setCart] = useState(() => loadCart(owner));

  // Signing in, signing out, or switching accounts swaps in that owner's cart before anything
  // renders with the previous one (React re-renders immediately, without committing).
  if (cartOwner !== owner) {
    setCartOwner(owner);
    setCart(loadCart(owner));
  }

  useEffect(() => {
    writeCart(storageKey(cartOwner), cart);
  }, [cartOwner, cart]);

  function addToCart(product) {
    if (!product || Number(product.stock) < 1) return;

    setCart((currentCart) => {
      const existingItem = currentCart.find((item) => item._id === product._id);
      if (!existingItem) return [...currentCart, { ...product, quantity: 1 }];

      return currentCart.map((item) =>
        item._id === product._id
          ? { ...item, quantity: Math.min(item.quantity + 1, Number(item.stock)) }
          : item,
      );
    });
  }

  function updateQuantity(productId, quantity) {
    const nextQuantity = Number(quantity);
    if (nextQuantity < 1) {
      setCart((currentCart) => currentCart.filter((item) => item._id !== productId));
      return;
    }

    setCart((currentCart) =>
      currentCart.map((item) =>
        item._id === productId
          ? { ...item, quantity: Math.min(nextQuantity, Number(item.stock)) }
          : item,
      ),
    );
  }

  function removeFromCart(productId) {
    setCart((currentCart) => currentCart.filter((item) => item._id !== productId));
  }

  function clearCart() {
    setCart([]);
  }

  const itemCount = cart.reduce((total, item) => total + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{ cart, itemCount, addToCart, updateQuantity, removeFromCart, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
}
