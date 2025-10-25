// web/src/pages/OwnerPortal.jsx
import React, { useEffect, useMemo, useState } from "react";

export default function OwnerPortal() {
  const [me, setMe] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [offers, setOffers] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Restaurant form state
  const [rform, setRform] = useState({ name: "", area: "", heroUrl: "" });
  const setR = (k, v) => setRform((s) => ({ ...s, [k]: v }));

  // Offer form state
  const [oform, setOform] = useState({
    title: "",
    type: "discount",
    price: "",
    originalPrice: "",
    qty: "0",
    pickupStart: "17:00",
    pickupEnd: "19:00",
    photoUrl: "",
  });
  const setO = (k, v) => setOform((s) => ({ ...s, [k]: v }));

  async function loadMe() {
    const res = await fetch("http://localhost:4000/api/auth/me", { credentials: "include" });
    const data = await res.json();
    setMe(data && data.id ? data : null);
  }

  async function loadRestaurant() {
    const res = await fetch("http://localhost:4000/api/me/restaurant", { credentials: "include" });
    if (res.status === 401) { setErr("Please sign in as an owner."); return; }
    const data = await res.json();
    setRestaurant(data);
    if (data) setRform({ name: data.name, area: data.area || "", heroUrl: data.heroUrl || "" });
  }

  async function loadOffers() {
    const res = await fetch("http://localhost:4000/api/me/offers", { credentials: "include" });
    if (!res.ok) { setOffers([]); return; }
    const data = await res.json();
    setOffers(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    (async () => {
      setErr(""); setBusy(true);
      try {
        await loadMe();
        await loadRestaurant();
        await loadOffers();
      } catch (e) {
        setErr("Failed to load portal.");
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  const discountPct = (o) => {
    const d = ((o.originalPriceCents - o.priceCents) / o.originalPriceCents) * 100;
    return Number.isFinite(d) ? Math.round(d) : 0;
  };

  async function saveRestaurant(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const res = await fetch("http://localhost:4000/api/me/restaurant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(rform),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save restaurant");
      setRestaurant(data);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  async function createOffer(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const payload = {
        ...oform,
        price: oform.price,
        originalPrice: oform.originalPrice,
      };
      const res = await fetch("http://localhost:4000/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create offer");
      setOffers((s) => [data, ...s]);
      // Reset minimal fields
      setOform((s) => ({ ...s, title: "", price: "", originalPrice: "", qty: "0", photoUrl: "" }));
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteOffer(id) {
    if (!confirm("Delete this offer?")) return;
    setErr("");
    try {
      const res = await fetch(`http://localhost:4000/api/offers/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      setOffers((s) => s.filter((o) => o.id !== id));
    } catch (e2) {
      setErr(e2.message);
    }
  }

  return (
    <div className="container">
      <h2 className="mb-3">Owner portal</h2>
      {err && <div className="alert alert-danger">{err}</div>}

      {/* Restaurant profile */}
      <div className="card mb-4">
        <div className="card-body">
          <h5 className="card-title">
            {restaurant ? "Your restaurant profile" : "Create your restaurant profile"}
          </h5>

          <form className="row g-3" onSubmit={saveRestaurant}>
            <div className="col-md-5">
              <label className="form-label">Name</label>
              <input className="form-control" value={rform.name} onChange={(e)=>setR("name", e.target.value)} required />
            </div>
            <div className="col-md-3">
              <label className="form-label">Area/Suburb</label>
              <input className="form-control" value={rform.area} onChange={(e)=>setR("area", e.target.value)} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Hero image URL</label>
              <input className="form-control" value={rform.heroUrl} onChange={(e)=>setR("heroUrl", e.target.value)} required />
            </div>
            <div className="col-12">
              <button className="btn btn-dark" disabled={busy}>{busy ? "Saving…" : restaurant ? "Update profile" : "Create profile"}</button>
            </div>
          </form>
        </div>
      </div>

      {/* Create Offer */}
      <div className="card mb-4">
        <div className="card-body">
          <h5 className="card-title">Add a new offer</h5>
          <form className="row g-3" onSubmit={createOffer}>
            <div className="col-md-4">
              <label className="form-label">Title</label>
              <input className="form-control" value={oform.title} onChange={(e)=>setO("title", e.target.value)} required />
            </div>
            <div className="col-md-2">
              <label className="form-label">Type</label>
              <select className="form-select" value={oform.type} onChange={(e)=>setO("type", e.target.value)}>
                <option value="discount">discount</option>
                <option value="mystery">mystery</option>
                <option value="donation">donation</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label">Price (A$)</label>
              <input type="number" step="0.01" className="form-control" value={oform.price} onChange={(e)=>setO("price", e.target.value)} required />
            </div>
            <div className="col-md-2">
              <label className="form-label">Original (A$)</label>
              <input type="number" step="0.01" className="form-control" value={oform.originalPrice} onChange={(e)=>setO("originalPrice", e.target.value)} required />
            </div>
            <div className="col-md-2">
              <label className="form-label">Qty</label>
              <input type="number" min="0" className="form-control" value={oform.qty} onChange={(e)=>setO("qty", e.target.value)} />
            </div>
            <div className="col-md-2">
              <label className="form-label">Pickup start</label>
              <input className="form-control" value={oform.pickupStart} onChange={(e)=>setO("pickupStart", e.target.value)} />
            </div>
            <div className="col-md-2">
              <label className="form-label">Pickup end</label>
              <input className="form-control" value={oform.pickupEnd} onChange={(e)=>setO("pickupEnd", e.target.value)} />
            </div>
            <div className="col-md-8">
              <label className="form-label">Photo URL (optional)</label>
              <input className="form-control" value={oform.photoUrl} onChange={(e)=>setO("photoUrl", e.target.value)} placeholder="Defaults to restaurant hero if empty" />
            </div>
            <div className="col-12">
              <button className="btn btn-dark" disabled={busy}>{busy ? "Creating…" : "Create offer"}</button>
            </div>
          </form>
        </div>
      </div>

      {/* My offers */}
      <div className="card">
        <div className="card-body">
          <h5 className="card-title">My offers</h5>
          {offers.length === 0 ? (
            <p className="text-muted mb-0">No offers yet.</p>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Price</th>
                    <th>Original</th>
                    <th>Disc%</th>
                    <th>Qty</th>
                    <th>Pickup</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {offers.map((o) => (
                    <tr key={o.id}>
                      <td className="fw-medium">{o.title}</td>
                      <td>{o.type}</td>
                      <td>${(o.priceCents / 100).toFixed(2)}</td>
                      <td>${(o.originalPriceCents / 100).toFixed(2)}</td>
                      <td>{discountPct(o)}%</td>
                      <td>{o.qty}</td>
                      <td>{o.pickup.start}–{o.pickup.end}</td>
                      <td className="text-end">
                        <button className="btn btn-sm btn-outline-danger" onClick={() => deleteOffer(o.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
