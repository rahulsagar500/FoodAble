// web/src/pages/cart.jsx
import { useMemo, useState } from "react";
import { useCart } from "../cart/CartContext.jsx";
import { formatPrice } from "../lib/format";
import useMe from "../lib/useMe";
import LoginPrompt from "../components/LoginPrompt";
import { checkoutCart } from "../api/offers";

export default function CartPage() {
  const { items: rawItems, inc, dec, remove, clear } = useCart();
  const items = Array.isArray(rawItems) ? rawItems : []; // <-- harden
  const { isAuthed } = useMe();
  const [showLogin, setShowLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const totalCents = useMemo(
    () => items.reduce((sum, it) => sum + (it.offer?.priceCents ?? it.priceCents ?? 0) * (it.qty ?? 0), 0),
    [items]
  );

  const onCheckout = async () => {
    setError("");
    setResult(null);
    if (!isAuthed) {
      setShowLogin(true);
      return;
    }
    if (items.length === 0) return;

    const payload = items.map((it) => ({
      offerId: it.offer?.id ?? it.id,
      qty: it.qty ?? 1,
    }));

    try {
      setBusy(true);
      const res = await checkoutCart(payload);
      setResult(res);
      clear();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Checkout failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container py-4">
      <h3 className="mb-3">Your cart</h3>

      {error && <div className="alert alert-danger">{error}</div>}
      {result?.orderIds?.length > 0 && (
        <div className="alert alert-success">Reserved! Order IDs: {result.orderIds.join(", ")}</div>
      )}

      {items.length === 0 ? (
        <div className="text-muted">Your cart is empty.</div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th>Item</th>
                  <th style={{ width: 140 }}>Price</th>
                  <th style={{ width: 170 }}>Qty</th>
                  <th style={{ width: 140 }}>Subtotal</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const o = it.offer || it;
                  const id = o?.id ?? Math.random().toString(36);
                  const title = o?.title ?? "Item";
                  const price = o?.priceCents ?? 0;
                  const qty = it?.qty ?? 0;
                  const subtotal = price * qty;
                  return (
                    <tr key={id}>
                      <td>
                        <div className="d-flex align-items-center gap-3">
                          <img
                            src={o?.photoUrl || "/placeholder.jpg"}
                            alt={title}
                            style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8 }}
                          />
                          <div>
                            <div className="fw-semibold">{title}</div>
                            <div className="text-muted small">{o?.restaurant?.name}</div>
                            <div className="text-muted small">
                              Pickup {o?.pickup?.start}–{o?.pickup?.end}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="fw-semibold">{formatPrice(price)}</td>
                      <td>
                        <div className="btn-group" role="group">
                          <button className="btn btn-outline-secondary" onClick={() => inc(o.id)} aria-label="Increase">+</button>
                          <button className="btn btn-light" disabled>{qty}</button>
                          <button className="btn btn-outline-secondary" onClick={() => dec(o.id)} aria-label="Decrease">-</button>
                        </div>
                      </td>
                      <td className="fw-semibold">{formatPrice(subtotal)}</td>
                      <td>
                        <button className="btn btn-outline-danger btn-sm" onClick={() => remove(o.id)}>Remove</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="text-end fw-semibold">Total</td>
                  <td className="fw-bold">{formatPrice(totalCents)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="d-flex gap-2">
            <button className="btn btn-outline-secondary" onClick={clear} disabled={busy}>Clear cart</button>
            <button className="btn btn-primary" onClick={onCheckout} disabled={busy}>
              {busy ? "Processing…" : "Checkout & Reserve"}
            </button>
          </div>
        </>
      )}

      <LoginPrompt show={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
