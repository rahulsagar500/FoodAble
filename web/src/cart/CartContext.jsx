// web/src/cart/CartContext.jsx
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";

const CartContext = createContext(null);
const LS_KEY = "foodable_cart_v1";

/**
 * Item shape we store:
 * { id: string, qty: number, offer: { ...offer fields we display... } }
 */
function normaliseOffer(offer) {
  if (!offer || !offer.id) throw new Error("Offer missing id");
  // Keep only fields the UI needs
  const {
    id, title, priceCents, originalPriceCents, photoUrl,
    pickup, restaurant,
  } = offer;
  return { id, title, priceCents, originalPriceCents, photoUrl, pickup, restaurant };
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(items));
    } catch {
      // ignore quota errors
    }
  }, [items]);

  // --- actions ---
  const add = useCallback((offer, qty = 1) => {
    const o = normaliseOffer(offer);
    setItems((prev) => {
      const arr = Array.isArray(prev) ? [...prev] : [];
      const i = arr.findIndex((it) => it.id === o.id);
      if (i >= 0) {
        arr[i] = { ...arr[i], qty: arr[i].qty + qty };
      } else {
        arr.push({ id: o.id, qty, offer: o });
      }
      return arr;
    });
  }, []);

  const inc = useCallback((id, step = 1) => {
    setItems((prev) =>
      (Array.isArray(prev) ? prev : []).map((it) =>
        it.id === id ? { ...it, qty: it.qty + step } : it
      )
    );
  }, []);

  const dec = useCallback((id, step = 1) => {
    setItems((prev) =>
      (Array.isArray(prev) ? prev : []).flatMap((it) => {
        if (it.id !== id) return it;
        const nextQty = it.qty - step;
        return nextQty > 0 ? { ...it, qty: nextQty } : [];
      })
    );
  }, []);

  const remove = useCallback((id) => {
    setItems((prev) => (Array.isArray(prev) ? prev : []).filter((it) => it.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  // Derived values
  const count = useMemo(
    () => (Array.isArray(items) ? items.reduce((n, it) => n + (it.qty || 0), 0) : 0),
    [items]
  );

  const value = useMemo(
    () => ({ items: Array.isArray(items) ? items : [], add, inc, dec, remove, clear, count }),
    [items, add, inc, dec, remove, clear, count]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within <CartProvider>");
  return ctx;
}
