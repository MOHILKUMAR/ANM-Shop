import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { apiRequest } from "../api.js";
import { formatInr } from "../money.js";
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

const isProductId = (id) => /^[a-f\d]{24}$/i.test(String(id));

// The cart with the shop's current name, price, and stock for each product that was looked up
// (`fresh` holds the ones still sold). Gone or sold-out products are dropped and quantities
// are capped at the stock. Items added after the lookup started are left alone.
function withCurrentDetails(cart, fresh, checked) {
  return cart.flatMap((item) => {
    if (!checked.has(item._id)) return [item];
    const product = fresh.get(item._id);
    if (!product || product.stock < 1) return [];
    const { name, price, stock, category, imageUrls } = product;
    return [{ ...item, name, price, stock, category, imageUrls, quantity: Math.min(item.quantity, stock) }];
  });
}

// One sentence per change the customer should know about.
function describeChanges(cart, fresh, checked) {
  const notes = [];
  for (const item of cart) {
    if (!checked.has(item._id)) continue;
    const product = fresh.get(item._id);
    if (!product) {
      notes.push(`${item.name || "An item"} is no longer sold, so it was removed from your cart.`);
    } else if (product.stock < 1) {
      notes.push(`${product.name} is sold out, so it was removed from your cart.`);
    } else {
      if (item.quantity > product.stock) notes.push(`Only ${product.stock} of ${product.name} left, so your quantity was lowered.`);
      if (Number(product.price) !== Number(item.price)) notes.push(`${product.name} now costs ${formatInr(product.price)} (was ${formatInr(item.price)}).`);
    }
  }
  return notes;
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

  // The latest cart for refreshCart, which must not change identity on every cart edit.
  const cartRef = useRef(cart);
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  // The cart keeps the price and stock from when each item was added. This replaces them with
  // the shop's current ones (the server charges those anyway) and resolves what changed.
  const refreshCart = useCallback(async () => {
    const snapshot = cartRef.current;
    const checked = new Set(snapshot.map((item) => item._id).slice(0, 50));
    if (!checked.size) return [];
    const ids = [...checked].filter(isProductId);
    const { items } = ids.length
      ? await apiRequest(`/products/lookup?ids=${ids.join(",")}`)
      : { items: [] };
    const fresh = new Map(items.map((product) => [String(product._id), product]));
    // Describe the cart as it is now, not as it was when the lookup started, so a quantity
    // changed while waiting still gets its "only N left" note.
    const notes = describeChanges(cartRef.current, fresh, checked);
    setCart((current) => withCurrentDetails(current, fresh, checked));
    return notes;
  }, []);

  function addToCart(product) {
    if (!product || Number(product.stock) < 1) return;

    setCart((currentCart) => {
      const existingItem = currentCart.find((item) => item._id === product._id);
      if (!existingItem) return [...currentCart, { ...product, quantity: 1 }];

      return currentCart.map((item) =>
        // The product being added is the latest copy, so its price and stock replace the saved ones.
        item._id === product._id
          ? { ...item, ...product, quantity: Math.min(item.quantity + 1, Number(product.stock)) }
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
      value={{ cart, itemCount, addToCart, updateQuantity, removeFromCart, clearCart, refreshCart }}
    >
      {children}
    </CartContext.Provider>
  );
}
