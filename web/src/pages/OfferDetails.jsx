import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getOffer, reserveOffer, formatPrice } from "../api/offers";

export default function OfferDetails() {
  const { id } = useParams();
  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reserving, setReserving] = useState(false);
  const [order, setOrder] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getOffer(id)
      .then((data) => { if (mounted) { setOffer(data); setLoading(false); }})
      .catch((e) => { if (mounted) { setError(e.message || "Not found"); setLoading(false); }});
    return () => { mounted = false; };
  }, [id]);

  async function onReserve() {
    setReserving(true);
    setError(null);
    try {
      const result = await reserveOffer(id);
      setOrder(result);
      setOffer((prev) => (prev ? { ...prev, qty: Math.max(0, prev.qty - 1) } : prev));
    } catch (e) {
      setError(e.message || "Could not reserve");
    } finally {
      setReserving(false);
    }
  }

  if (loading) return <div className="container my-5 text-muted">Loading…</div>;
  if (!offer) {
    return (
      <div className="container my-5">
        <div className="alert alert-danger">{error || "Not found"}</div>
        <Link to="/" className="btn btn-outline-secondary">Back</Link>
      </div>
    );
  }

  const pct = Math.round((1 - offer.priceCents / offer.originalPriceCents) * 100) || 0;

  return (
    <div className="container my-4">
      <Link to="/" className="btn btn-link">&larr; Back</Link>

      <div className="card shadow-sm mt-2">
        {offer.photoUrl && (
          <img
            src={offer.photoUrl}
            alt={offer.title}
            className="card-img-top"
            style={{ height: 260, objectFit: "cover" }}
          />
        )}
        <div className="card-body">
          <div className="d-flex align-items-center gap-2 mb-2">
            <span className="badge bg-secondary text-uppercase">{offer.type}</span>
            <h2 className="h4 m-0">{offer.title}</h2>
          </div>
          <div className="text-muted mb-2">
            {offer.restaurant} • {offer.distanceKm} km away
          </div>

          <div className="mb-2">
            <span className="fw-semibold">{formatPrice(offer.priceCents)}</span>
            <span className="text-muted text-decoration-line-through ms-2">
              {formatPrice(offer.originalPriceCents)}
            </span>
            <span className="ms-2 badge bg-success">{pct}% off</span>
          </div>

          <div className="small text-muted mb-3">
            Pickup {offer.pickup.start}–{offer.pickup.end}
          </div>

          {order && (
            <div className="alert alert-success d-flex justify-content-between align-items-center">
              <div>
                Reserved! Order ID: <strong>{order.orderId}</strong>. Show this at pickup.
              </div>
              <Link to="/" className="btn btn-sm btn-success">Go to Explore</Link>
            </div>
          )}
          {error && <div className="alert alert-danger">{error}</div>}

          <div className="d-flex align-items-center gap-2">
            <span className={`badge ${offer.qty > 0 ? "bg-primary" : "bg-danger"}`}>
              {offer.qty > 0 ? `${offer.qty} left` : "Sold out"}
            </span>
            <button
              className="btn btn-dark"
              disabled={offer.qty <= 0 || reserving || !!order}
              onClick={onReserve}
            >
              {reserving ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  Reserving…
                </>
              ) : (
                "Reserve"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
