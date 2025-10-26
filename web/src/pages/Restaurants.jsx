import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listOffers } from "../api/offers";
import { formatPrice } from "../lib/format";

export default function Restaurants() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI state
  const [search, setSearch] = useState("");
  const [nearby, setNearby] = useState(true);
  const [filterTypes, setFilterTypes] = useState({
    mystery: true,
    donation: true,
    discount: true,
  });
  const [maxDistance, setMaxDistance] = useState(10);

  useEffect(() => {
    let mounted = true;
    listOffers()
      .then((data) => {
        if (mounted) {
          setOffers(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (mounted) {
          setError(e?.message || "Failed to load offers");
          setLoading(false);
        }
      });
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    const out = (offers || []).filter((o) => {
      const restName =
        typeof o.restaurant === "string" ? o.restaurant : (o.restaurant?.name || "");

      const title = (o.title || "").toLowerCase();
      const matchesQ = !q || title.includes(q) || restName.toLowerCase().includes(q);

      const matchesType = filterTypes[o.type] ?? true;

      const dist = Number.isFinite(o.distanceKm) ? o.distanceKm : Infinity;
      const matchesDistance = !nearby || dist <= maxDistance;

      return matchesQ && matchesType && matchesDistance;
    });

    if (nearby) {
      out.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    } else {
      const disc = (x) => 1 - (x.priceCents / x.originalPriceCents);
      out.sort((a, b) => disc(b) - disc(a));
    }
    return out;
  }, [offers, search, filterTypes, nearby, maxDistance]);

  if (loading) return <div className="container my-5 text-muted">Loading offers…</div>;
  if (error) return <div className="container my-5"><div className="alert alert-danger">{error}</div></div>;

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
              placeholder="Search"
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
          Displaying <strong>{filtered.length}</strong> of the {offers.length} best restaurants in Brisbane near me
        </div>

        {/* Cards list */}
        <div className="mt-3">
          {filtered.map((o) => {
            const pct = Math.round((1 - o.priceCents / o.originalPriceCents) * 100) || 0;
            const sold = (o.qty ?? 0) <= 0;
            const restName =
              typeof o.restaurant === "string" ? o.restaurant : (o.restaurant?.name || "");
            const distText = Number.isFinite(o.distanceKm) ? `${o.distanceKm} km away` : "";

            return (
              <div key={o.id} className="card mb-3">
                <div className="row g-0 align-items-center">
                  <div className="col-md-3">
                    <div className="position-relative">
                      <img
                        src={o.photoUrl || "/placeholder.jpg"}
                        alt={o.title}
                        className="img-fluid rounded-start"
                        style={{ height: 160, width: "100%", objectFit: "cover" }}
                      />
                      <span className={`badge position-absolute top-0 start-0 m-2 ${sold ? "bg-danger" : "bg-primary"}`}>
                        {sold ? "Sold out" : `${o.qty} left`}
                      </span>
                    </div>
                  </div>
                  <div className="col-md-9">
                    <div className="card-body d-flex justify-content-between align-items-start flex-wrap">
                      <div style={{ minWidth: 240 }}>
                        <div className="d-flex align-items-center gap-2">
                          <span className="badge bg-secondary text-uppercase">{o.type}</span>
                          <h3 className="h5 m-0">{o.title}</h3>
                        </div>
                        <div className="text-muted">
                          {restName}{distText && ` • ${distText}`}
                        </div>
                        <div className="mt-2">
                          <span className="fw-semibold">{formatPrice(o.priceCents)}</span>
                          <span className="text-muted text-decoration-line-through ms-2">
                            {formatPrice(o.originalPriceCents)}
                          </span>
                          <span className="ms-2 badge bg-success">{pct}% off</span>
                        </div>
                        <div className="small text-muted mt-1">
                          Pickup {o.pickup?.start}–{o.pickup?.end}
                        </div>
                      </div>
                      <div className="mt-3 mt-md-0">
                        <Link to={`/offers/${o.id}`} className="btn btn-dark">
                          View
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="alert alert-light border mt-3">
              No results. Try clearing filters or increasing distance.
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
                      checked={!!filterTypes[t]}
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

              <div className="mb-2">
                <label htmlFor="distanceRange" className="form-label">
                  Max distance {nearby ? `(${maxDistance} km)` : "(ignored when Nearby is OFF)"}
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
