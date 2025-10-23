import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listRestaurants } from "../api/restaurants";
import { createOffer } from "../api/offers";

export default function RestaurantPortal() {
  const nav = useNavigate();
  const [restaurants, setRestaurants] = useState([]);
  const [form, setForm] = useState({
    restaurantId: "",
    title: "",
    type: "discount",
    price: "",
    originalPrice: "",
    qty: "1",
    pickupStart: "17:00",
    pickupEnd: "19:00",
    photoUrl: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listRestaurants().then((rs) => {
      setRestaurants(rs);
      if (rs[0]) setForm((f) => ({ ...f, restaurantId: rs[0].id }));
    });
  }, []);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const created = await createOffer(form);
      nav(`/restaurants/${created.restaurantId}`);
    } catch (err) {
      setError(err.message || "Could not create offer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container my-4" style={{ maxWidth: 720 }}>
      <h1 className="h4 mb-3">Restaurant Portal — Create Offer</h1>
      {error && <div className="alert alert-danger">{error}</div>}
      <form onSubmit={onSubmit} className="card p-3 shadow-sm">
        <div className="mb-3">
          <label className="form-label">Restaurant</label>
          <select
            className="form-select"
            name="restaurantId"
            value={form.restaurantId}
            onChange={onChange}
          >
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        <div className="mb-3">
          <label className="form-label">Title</label>
          <input className="form-control" name="title" value={form.title} onChange={onChange} required />
        </div>

        <div className="row">
          <div className="col-md-4 mb-3">
            <label className="form-label">Type</label>
            <select className="form-select" name="type" value={form.type} onChange={onChange}>
              <option value="discount">Discount</option>
              <option value="mystery">Mystery</option>
              <option value="donation">Donation</option>
            </select>
          </div>
          <div className="col-md-4 mb-3">
            <label className="form-label">Price ($)</label>
            <input className="form-control" name="price" value={form.price} onChange={onChange} required />
          </div>
          <div className="col-md-4 mb-3">
            <label className="form-label">Original Price ($)</label>
            <input className="form-control" name="originalPrice" value={form.originalPrice} onChange={onChange} required />
          </div>
        </div>

        <div className="row">
          <div className="col-md-4 mb-3">
            <label className="form-label">Quantity</label>
            <input className="form-control" name="qty" value={form.qty} onChange={onChange} />
          </div>
          <div className="col-md-4 mb-3">
            <label className="form-label">Pickup Start (HH:MM)</label>
            <input className="form-control" name="pickupStart" value={form.pickupStart} onChange={onChange} />
          </div>
          <div className="col-md-4 mb-3">
            <label className="form-label">Pickup End (HH:MM)</label>
            <input className="form-control" name="pickupEnd" value={form.pickupEnd} onChange={onChange} />
          </div>
        </div>

        <div className="mb-3">
          <label className="form-label">Photo URL (optional)</label>
          <input className="form-control" name="photoUrl" value={form.photoUrl} onChange={onChange} placeholder="https://…" />
          <div className="form-text">Leave blank to reuse the restaurant’s hero image.</div>
        </div>

        <button className="btn btn-dark" disabled={saving}>
          {saving ? "Saving…" : "Create Offer"}
        </button>
      </form>
    </div>
  );
}
