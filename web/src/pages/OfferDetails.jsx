// web/src/pages/OfferDetails.jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getOffer, reserveOffer } from "../api/offers";
import { useCart } from "../cart/CartContext.jsx";
import { formatPrice } from "../lib/format";
import useMe from "../lib/useMe";
import LoginPrompt from "../components/LoginPrompt";

export default function OfferDetails() {
  const { id } = useParams();
  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const { add } = useCart();
  const { isAuthed } = useMe();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getOffer(id)
      .then((data) => mounted && (setOffer(data), setLoading(false)))
      .catch(() => mounted && (setOffer(null), setLoading(false)));
    return () => { mounted = false; };
  }, [id]);

  if (loading) return <div className="container py-4">Loading…</div>;
  if (!offer) return <div className="container py-4">Offer not found.</div>;

  const discountPct = Math.max(0, Math.round(100 - (offer.priceCents / offer.originalPriceCents) * 100));

  const onAddToCart = () => add(offer);

  const onReserve = async () => {
    setError("");
    if (!isAuthed) {
      setShowLogin(true);
      return;
    }
    try {
      setBusy(true);
      const res = await reserveOffer(offer.id);
      // optimistic local qty update (also true in DB from API)
      setOffer((prev) => (prev ? { ...prev, qty: Math.max(0, (prev.qty ?? 0) - 1) } : prev));
      alert(`Reserved! Order ID: ${res.orderId}`);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to reserve");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container py-4">
      <div className="row g-4">
        <div className="col-md-6">
          <img className="img-fluid rounded" src={offer.photoUrl || "/placeholder.jpg"} alt={offer.title} />
        </div>
        <div className="col-md-6">
          <h2 className="mb-2">{offer.title}</h2>
          <div className="text-muted mb-2">{offer.restaurant?.name}</div>
          <div className="d-flex align-items-center gap-3 mb-2">
            <span className="badge bg-success">{discountPct}% OFF</span>
            <span className="fw-bold">{formatPrice(offer.priceCents)}</span>
            <span className="text-decoration-line-through text-muted">{formatPrice(offer.originalPriceCents)}</span>
          </div>
          <div className="mb-2">
            Pickup: <strong>{offer.pickup?.start}</strong>–<strong>{offer.pickup?.end}</strong>
          </div>
          <div className="mb-3">
            Qty left: <strong>{offer.qty}</strong>
          </div>

          {error && <div className="alert alert-danger py-2">{error}</div>}

          <div className="d-flex gap-2">
            <button className="btn btn-outline-primary" onClick={onAddToCart} disabled={(offer.qty ?? 0) <= 0}>
              Add to cart
            </button>
            <button className="btn btn-primary" onClick={onReserve} disabled={busy || (offer.qty ?? 0) <= 0}>
              {busy ? "Reserving…" : "Reserve now"}
            </button>
          </div>

          <p className="text-muted mt-3 mb-0">You can add to cart without signing in. Sign in is required to reserve.</p>
        </div>
      </div>

      <LoginPrompt show={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
