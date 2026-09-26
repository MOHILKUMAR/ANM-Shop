import { useEffect, useState } from "react";
import CartContext from "./CartContext.js";

function readSavedCart() {
  try {
    const savedCart = JSON.parse(localStorage.getItem("shopnestCart") || "[]");
    return Array.isArray(savedCart) ? savedCart : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(readSavedCart);

  useEffect(() => {
    localStorage.setItem("shopnestCart", JSON.stringify(cart));
  }, [cart]);

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
