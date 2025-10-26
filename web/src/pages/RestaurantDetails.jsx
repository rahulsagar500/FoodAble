// web/src/pages/RestaurantDetails.jsx
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getRestaurant } from "../api/restaurants";
import { listOffersByRestaurant, reserveOffer } from "../api/offers";
import { useCart } from "../cart/CartContext.jsx";
import { formatPrice } from "../lib/format";
import useMe from "../lib/useMe";
import LoginPrompt from "../components/LoginPrompt";

export default function RestaurantDetails() {
  const { id } = useParams();
  const [rest, setRest] = useState(null);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [errorId, setErrorId] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const { add } = useCart();
  const { isAuthed } = useMe();

  useEffect(() => {
    let mounted = true;
    Promise.all([getRestaurant(id), listOffersByRestaurant(id)])
      .then(([r, os]) => { if (mounted) { setRest(r); setOffers(os); setLoading(false); }})
      .catch(() => setLoading(false));
    return () => { mounted = false; };
  }, [id]);

  if (loading) return <div className="container py-4">Loading…</div>;
  if (!rest) return <div className="container py-4">Restaurant not found.</div>;

  const onAdd = (offer) => add(offer);

  const onReserve = async (offer) => {
    setErrorId(null);
    if (!isAuthed) {
      setShowLogin(true);
      return;
    }
    try {
      setBusyId(offer.id);
      const res = await reserveOffer(offer.id);
      // optimistic qty decrement for that card
      setOffers((prev) =>
        prev.map((o) => (o.id === offer.id ? { ...o, qty: Math.max(0, (o.qty ?? 0) - 1) } : o))
      );
      alert(`Reserved! Order ID: ${res.orderId}`);
    } catch (e) {
      setErrorId(offer.id);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="container py-4">
      <div className="d-flex align-items-center gap-3 mb-3">
        <img src={rest.heroUrl || "/placeholder.jpg"} alt={rest.name} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8 }} />
        <div>
          <h2 className="mb-0">{rest.name}</h2>
          {rest.area && <div className="text-muted">{rest.area}</div>}
        </div>
      </div>

      <div className="row g-3">
        {offers.map((o) => {
          const pct = Math.max(0, Math.round(100 - (o.priceCents / o.originalPriceCents) * 100));
          return (
            <div key={o.id} className="col-md-6 col-xl-4">
              <div className="card h-100">
                <img className="card-img-top" src={o.photoUrl || "/placeholder.jpg"} alt={o.title} />
                <div className="card-body d-flex flex-column">
                  <h5 className="card-title">{o.title}</h5>
                  <div className="mb-1">
                    <span className="badge bg-success me-2">{pct}% OFF</span>
                    <strong className="me-2">{formatPrice(o.priceCents)}</strong>
                    <span className="text-muted text-decoration-line-through">{formatPrice(o.originalPriceCents)}</span>
                  </div>
                  <div className="text-muted mb-2">
                    Pickup {o.pickup?.start}–{o.pickup?.end} · Qty left: <strong>{o.qty ?? 0}</strong>
                  </div>
                  <div className="mt-auto d-flex gap-2">
                    <button className="btn btn-outline-primary" onClick={() => onAdd(o)} disabled={(o.qty ?? 0) <= 0}>
                      Add to cart
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => onReserve(o)}
                      disabled={busyId === o.id || (o.qty ?? 0) <= 0}
                    >
                      {busyId === o.id ? "Reserving…" : "Reserve"}
                    </button>
                    <Link to={`/offers/${o.id}`} className="btn btn-link">Details</Link>
                  </div>
                  {errorId === o.id && <div className="text-danger mt-2">Could not reserve. Try again.</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <LoginPrompt show={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
