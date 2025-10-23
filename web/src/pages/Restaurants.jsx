import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listRestaurants } from "../api/restaurants";
import { listOffers } from "../api/offers";

export default function Restaurants() {
  const [restaurants, setRestaurants] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([listRestaurants(), listOffers()]).then(([rs, os]) => {
      if (!mounted) return;
      setRestaurants(rs);
      setOffers(os);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const offersByRestaurant = useMemo(() => {
    const map = new Map();
    for (const o of offers) {
      if (!map.has(o.restaurantId)) map.set(o.restaurantId, []);
      map.get(o.restaurantId).push(o);
    }
    return map;
  }, [offers]);

  function topDiscountPct(rid) {
    const arr = offersByRestaurant.get(rid) || [];
    let best = 0;
    for (const o of arr) {
      const pct = 1 - o.priceCents / o.originalPriceCents;
      if (pct > best) best = pct;
    }
    return Math.round(best * 100);
  }

  if (loading) return <div className="container my-5 text-muted">Loading restaurants…</div>;

  return (
    <div className="container py-4">
      <h1 className="display-6 fw-semibold mb-3">Brisbane Restaurants</h1>
      <div className="row row-cols-1 row-cols-md-2 row-cols-lg-4 g-3">
        {restaurants.map((r) => {
          const count = (offersByRestaurant.get(r.id) || []).length;
          const pct = topDiscountPct(r.id);
          return (
            <div className="col" key={r.id}>
              <div className="card h-100 shadow-sm">
                <img
                  src={r.heroUrl}
                  className="card-img-top"
                  alt={r.name}
                  style={{ height: 190, objectFit: "cover" }}
                />
                <div className="card-body d-flex flex-column">
                  <h3 className="h5">{r.name}</h3>
                  <div className="text-muted small mb-2">{r.area}</div>
                  <div className="mt-auto d-flex justify-content-between align-items-center">
                    <span className="badge bg-warning-subtle text-dark border">
                      ↑ {pct || 0}% OFF
                    </span>
                    <Link to={`/restaurants/${r.id}`} className="btn btn-outline-dark">
                      ➜
                    </Link>
                  </div>
                  <div className="text-muted small mt-2">{count} offer(s)</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
