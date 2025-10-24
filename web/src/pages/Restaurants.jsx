import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listRestaurants } from "../api/restaurants";
import { listOffers } from "../api/offers";

export default function Restaurants() {
  // data
  const [restaurants, setRestaurants] = useState([]);
  const [offers, setOffers] = useState([]);

  // ui state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [nearby, setNearby] = useState(true);
  const [maxDistance, setMaxDistance] = useState(10); // km
  const [filterTypes, setFilterTypes] = useState({
    mystery: true,
    donation: true,
    discount: true,
  });
  const [minDiscount, setMinDiscount] = useState(0); // %
  const [onlyAvailable, setOnlyAvailable] = useState(false); // qty > 0

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    Promise.all([listRestaurants(), listOffers()])
      .then(([rs, os]) => {
        if (!mounted) return;
        setRestaurants(rs);
        setOffers(os);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.message || "Failed to load restaurants");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Build quick indexes from offers
  const offersByRestaurant = useMemo(() => {
    const map = new Map();
    for (const o of offers) {
      if (!map.has(o.restaurantId)) map.set(o.restaurantId, []);
      map.get(o.restaurantId).push(o);
    }
    return map;
  }, [offers]);

  function discountPct(o) {
    return Math.round((1 - o.priceCents / o.originalPriceCents) * 100) || 0;
  }

  function offerMatches(o) {
    if (!filterTypes[o.type]) return false;
    if (onlyAvailable && o.qty <= 0) return false;
    if (discountPct(o) < minDiscount) return false;
    if (nearby && o.distanceKm > maxDistance) return false;
    return true;
    // photo/type/qty/price handled by card itself
  }

  // Compute filtered, sorted restaurants with metrics for display
  const results = useMemo(() => {
    const q = search.trim().toLowerCase();

    return restaurants
      .map((r) => {
        const items = offersByRestaurant.get(r.id) || [];

        // subset of offers that pass filters
        const eligible = items.filter(offerMatches);

        // search by restaurant name/area
        const searchMatch =
          !q ||
          r.name.toLowerCase().includes(q) ||
          (r.area || "").toLowerCase().includes(q);

        // metrics for sorting/badges
        let bestDiscount = 0;
        let closestKm = Number.POSITIVE_INFINITY;
        for (const o of eligible) {
          const pct = discountPct(o);
          if (pct > bestDiscount) bestDiscount = pct;
          if (o.distanceKm < closestKm) closestKm = o.distanceKm;
        }

        return {
          r,
          eligibleCount: eligible.length,
          bestDiscount,
          closestKm,
          searchMatch,
        };
      })
      // show only restaurants that match search AND have at least one eligible offer
      .filter((x) => x.searchMatch && x.eligibleCount > 0)
      // sort: if Nearby ON → by distance; else → by best discount
      .sort((a, b) => {
        if (nearby) {
          return (a.closestKm || 1e9) - (b.closestKm || 1e9);
        }
        return (b.bestDiscount || 0) - (a.bestDiscount || 0);
      });
  }, [restaurants, offersByRestaurant, search, filterTypes, onlyAvailable, minDiscount, nearby, maxDistance]);

  if (loading) return <div className="container my-5 text-muted">Loading restaurants…</div>;
  if (error) {
    return (
      <div className="container my-5">
        <div className="alert alert-danger">{error}</div>
        <div className="text-muted small">
          Tip: ensure API is running at <code>http://localhost:4000</code>.
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb-ish bar */}
      <div className="border-bottom bg-light">
        <div className="container py-2 small text-muted">
          Home / All Venues / <strong>Brisbane</strong> —{" "}
          <a href="#" className="link-secondary">Change region</a>
        </div>
      </div>

      {/* Hero */}
      <div className="container py-4">
        <h1 className="display-5 fw-semibold">Brisbane Restaurants</h1>
        <p className="lead text-muted mb-3">
          Discover Brisbane’s best restaurant deals near me.
          Save up to 50% off the total bill, including drinks.
        </p>

        {/* Controls row */}
        <div className="d-flex flex-wrap align-items-center gap-3 py-2 border-top border-bottom">
          {/* Search */}
          <div className="input-group" style={{ maxWidth: 420 }}>
            <span className="input-group-text">🔎</span>
            <input
              type="text"
              className="form-control"
              placeholder="Search restaurants or areas"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Nearby toggle */}
          <div className="form-check form-switch ms-auto">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              id="nearbySwitch"
              checked={nearby}
              onChange={(e) => setNearby(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="nearbySwitch">
              Nearby: <strong>{nearby ? "ON" : "OFF"}</strong>
            </label>
          </div>

          {/* Filter button */}
          <button
            className="btn btn-outline-secondary"
            data-bs-toggle="modal"
            data-bs-target="#filtersModal"
          >
            <span className="me-1">⚙️</span> Filter
          </button>
        </div>

        {/* Display count */}
        <div className="mt-3 text-muted">
          Displaying <strong>{results.length}</strong> of {restaurants.length} restaurants
        </div>

        {/* Cards grid */}
        <div className="row row-cols-1 row-cols-md-2 row-cols-lg-4 g-3 mt-2">
          {results.map(({ r, eligibleCount, bestDiscount, closestKm }) => (
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
                      {nearby && isFinite(closestKm) ? `${closestKm.toFixed(1)} km` : `↑ ${bestDiscount || 0}% OFF`}
                    </span>
                    <Link to={`/restaurants/${r.id}`} className="btn btn-outline-dark">
                      ➜
                    </Link>
                  </div>
                  <div className="text-muted small mt-2">{eligibleCount} matching offer(s)</div>
                </div>
              </div>
            </div>
          ))}
          {results.length === 0 && (
            <div className="col-12">
              <div className="alert alert-light border mt-3">
                No results. Try clearing filters or increasing distance.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filters modal */}
      <div className="modal fade" id="filtersModal" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Filters</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label d-block">Offer types</label>
                {["mystery", "donation", "discount"].map((t) => (
                  <div className="form-check form-check-inline" key={t}>
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`t-${t}`}
                      checked={filterTypes[t]}
                      onChange={(e) =>
                        setFilterTypes((prev) => ({ ...prev, [t]: e.target.checked }))
                      }
                    />
                    <label className="form-check-label text-capitalize" htmlFor={`t-${t}`}>
                      {t}
                    </label>
                  </div>
                ))}
              </div>

              <div className="mb-3">
                <label htmlFor="discountRange" className="form-label">
                  Minimum discount: <strong>{minDiscount}%</strong>
                </label>
                <input
                  type="range"
                  className="form-range"
                  id="discountRange"
                  min="0"
                  max="80"
                  step="5"
                  value={minDiscount}
                  onChange={(e) => setMinDiscount(Number(e.target.value))}
                />
              </div>

              <div className="mb-3">
                <label htmlFor="distanceRange" className="form-label">
                  Max distance {nearby ? <>(<strong>{maxDistance} km</strong>)</> : "(ignored when Nearby is OFF)"}
                </label>
                <input
                  type="range"
                  className="form-range"
                  id="distanceRange"
                  min="1"
                  max="20"
                  value={maxDistance}
                  onChange={(e) => setMaxDistance(Number(e.target.value))}
                />
              </div>

              <div className="form-check mb-1">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="availableOnly"
                  checked={onlyAvailable}
                  onChange={(e) => setOnlyAvailable(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="availableOnly">
                  Only show offers with availability
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              <button className="btn btn-primary" data-bs-dismiss="modal">Apply</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
