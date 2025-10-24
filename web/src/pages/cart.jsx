import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../cart/CartContext.jsx";
import { reserveOffer } from "../api/offers";
import { formatPrice } from "../lib/format";

export default function Cart() {
  const { items, itemCount, totalCents, setQty, remove, clear } = useCart();
  const [checkingOut, setCheckingOut] = useState(false);
  const [result, setResult] = useState(null); // { ok: true, orders:[], errors:[] }

  const rows = useMemo(() => Object.values(items), [items]);

  async function onCheckout() {
    if (itemCount === 0 || checkingOut) return;
    setCheckingOut(true);
    const orders = [];
    const errors = [];

    for (const it of rows) {
      // Reserve `qty` times (one order per unit)
      for (let k = 0; k < it.qty; k++) {
        try {
          const res = await reserveOffer(it.id);
          orders.push({ offerId: it.id, orderId: res.orderId, title: it.title });
        } catch (e) {
          errors.push({ offerId: it.id, title: it.title, msg: e?.response?.data?.error || e.message });
          break; // stop trying this item if it failed (likely sold out)
        }
      }
    }

    // Clear cart on full success; else leave cart so user can adjust
    if (errors.length === 0) clear();

    setResult({ ok: errors.length === 0, orders, errors });
    setCheckingOut(false);
  }

  if (itemCount === 0 && !result) {
    return (
      <div className="container my-5">
        <h1 className="h4 mb-3">Your Cart</h1>
        <div className="alert alert-light border">Your cart is empty.</div>
        <Link to="/" className="btn btn-dark mt-2">Browse restaurants</Link>
      </div>
    );
  }

  return (
    <div className="container my-5" style={{ maxWidth: 900 }}>
      <h1 className="h4 mb-3">Your Cart</h1>

      {result && (
        <div className={`alert ${result.ok ? "alert-success" : "alert-warning"}`}>
          {result.ok ? (
            <>
              <strong>Success!</strong> {result.orders.length} order(s) placed. Show the Order ID(s) at pickup.
              <ul className="mt-2 mb-0">
                {result.orders.map((o) => (
                  <li key={o.orderId}><code>{o.orderId}</code> — {o.title}</li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <strong>Some items could not be reserved.</strong>
              <ul className="mt-2 mb-0">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    {e.title}: <code>{e.msg}</code>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {rows.length > 0 && (
        <div className="card shadow-sm">
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th style={{ width: 80 }}></th>
                  <th>Item</th>
                  <th style={{ width: 150 }}>Price</th>
                  <th style={{ width: 160 }}>Qty</th>
                  <th style={{ width: 150 }}>Subtotal</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((it) => (
                  <tr key={it.id}>
                    <td>
                      <img src={it.photoUrl} alt={it.title} style={{ width: 72, height: 48, objectFit: "cover" }} />
                    </td>
                    <td>
                      <div className="fw-semibold">{it.title}</div>
                      <div className="text-muted small">{it.restaurant}</div>
                    </td>
                    <td>{formatPrice(it.priceCents)}</td>
                    <td>
                      <div className="input-group">
                        <button className="btn btn-outline-secondary" onClick={() => setQty(it.id, it.qty - 1)}>-</button>
                        <input
                          type="number"
                          className="form-control text-center"
                          min="1"
                          value={it.qty}
                          onChange={(e) => {
                            const v = Math.max(1, parseInt(e.target.value || "1", 10));
                            setQty(it.id, v);
                          }}
                        />
                        <button className="btn btn-outline-secondary" onClick={() => setQty(it.id, it.qty + 1)}>+</button>
                      </div>
                    </td>
                    <td className="fw-semibold">{formatPrice(it.qty * it.priceCents)}</td>
                    <td>
                      <button className="btn btn-link text-danger" onClick={() => remove(it.id)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="table-light">
                <tr>
                  <td colSpan="4" className="text-end pe-3">Total:</td>
                  <td className="fw-bold">{formatPrice(totalCents)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mt-3">
        <Link to="/" className="btn btn-outline-secondary">Continue browsing</Link>
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-outline-danger" onClick={() => clear()} disabled={rows.length === 0}>
            Clear cart
          </button>
          <button className="btn btn-dark" onClick={onCheckout} disabled={rows.length === 0 || checkingOut}>
            {checkingOut ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" />
                Processing…
              </>
            ) : (
              "Checkout"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
