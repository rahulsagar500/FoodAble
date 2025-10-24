import React, { createContext, useContext, useEffect, useMemo, useReducer } from "react";

const CartContext = createContext(null);

const initialState = { items: {} }; // items[offerId] = { id, title, restaurant, priceCents, photoUrl, qty }

function reducer(state, action) {
  switch (action.type) {
    case "INIT":
      return action.payload || initialState;

    case "ADD": {
      const { item, qty = 1 } = action.payload;
      const existing = state.items[item.id];
      const newQty = (existing?.qty || 0) + qty;
      return { ...state, items: { ...state.items, [item.id]: { ...item, qty: newQty } } };
    }

    case "SET_QTY": {
      const { id, qty } = action.payload;
      const current = state.items[id];
      if (!current) return state;
      if (qty <= 0) {
        const next = { ...state.items };
        delete next[id];
        return { ...state, items: next };
      }
      return { ...state, items: { ...state.items, [id]: { ...current, qty } } };
    }

    case "REMOVE": {
      const next = { ...state.items };
      delete next[action.payload.id];
      return { ...state, items: next };
    }

    case "CLEAR":
      return initialState;

    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("cart");
      if (raw) dispatch({ type: "INIT", payload: JSON.parse(raw) });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on change
  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(state));
  }, [state]);

  const itemCount = useMemo(
    () => Object.values(state.items).reduce((sum, it) => sum + it.qty, 0),
    [state]
  );
  const totalCents = useMemo(
    () => Object.values(state.items).reduce((sum, it) => sum + it.qty * it.priceCents, 0),
    [state]
  );

  const value = useMemo(
    () => ({
      items: state.items,
      itemCount,
      totalCents,
      add: (item, qty = 1) => dispatch({ type: "ADD", payload: { item, qty } }),
      setQty: (id, qty) => dispatch({ type: "SET_QTY", payload: { id, qty } }),
      remove: (id) => dispatch({ type: "REMOVE", payload: { id } }),
      clear: () => dispatch({ type: "CLEAR" }),
    }),
    [state, itemCount, totalCents]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  return useContext(CartContext);
}
