import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getRestaurant } from "../api/restaurants";
import { listOffersByRestaurant, formatPrice } from "../api/offers";

export default function RestaurantDetails() {
  const { id } = useParams();
  const [rest, setRest] = useState(null);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([getRestaurant(id), listOffersByRestaurant(id)]).then(([r, os]) => {
      if (!mounted) return;
      setRest(r);
      setOffers(os);
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { mounted = false; };
  }, [id]);

  if (loading) return <div className="container my-5 text-muted">Loading…</div>;
  if (!rest) {
    return (
      <div className="container my-5">
        <div className="alert alert-danger">Restaurant not found</div>
        <Link to="/restaurants" className="btn btn-outline-secondary">Back</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="position-relative">
        <img src={rest.heroUrl} alt={rest.name} style={{ width: "100%", height: 260, objectFit: "cover" }} />
        <div className="container position-absolute bottom-0 start-0 end-0">
          <div className="bg-dark text-white d-inline-block px-3 py-2 rounded-top">
            <h1 className="h3 m-0">{rest.name}</h1>
            <div className="text-muted small">{rest.area}</div>
          </div>
        </div>
      </div>

      <div className="container my-4">
        <Link to="/restaurants" className="btn btn-link">&larr; All restaurants</Link>

        <div className="row g-3 mt-2">
          {offers.map((o) => {
            const pct = Math.round((1 - o.priceCents / o.originalPriceCents) * 100) || 0;
            const sold = o.qty <= 0;
            return (
              <div className="col-12 col-md-6" key={o.id}>
                <div className="card h-100">
                  <img src={o.photoUrl} className="card-img-top" alt={o.title} style={{ height: 180, objectFit: "cover" }} />
                  <div className="card-body d-flex flex-column">
                    <div className="d-flex align-items-center gap-2">
                      <span className="badge bg-secondary text-uppercase">{o.type}</span>
                      <h3 className="h5 m-0">{o.title}</h3>
                    </div>
                    <div className="mt-2">
                      <span className="fw-semibold">{formatPrice(o.priceCents)}</span>
                      <span className="text-muted text-decoration-line-through ms-2">
                        {formatPrice(o.originalPriceCents)}
                      </span>
                      <span className="ms-2 badge bg-success">{pct}% off</span>
                    </div>
                    <div className="small text-muted mt-1">
                      Pickup {o.pickup.start}–{o.pickup.end}
                    </div>
                    <div className="mt-auto d-flex justify-content-between align-items-center">
                      <span className={`badge ${sold ? "bg-danger" : "bg-primary"}`}>
                        {sold ? "Sold out" : `${o.qty} left`}
                      </span>
                      <Link to={`/offers/${o.id}`} className="btn btn-dark">View</Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {offers.length === 0 && (
            <div className="col-12">
              <div className="alert alert-light border">No offers yet.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
