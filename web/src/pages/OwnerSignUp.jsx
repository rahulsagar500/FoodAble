// web/src/pages/OwnerSignUp.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

export default function OwnerSignUp() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    restaurantName: "",
    area: "",
    heroUrl: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const navigate = useNavigate();
  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  async function onSubmit(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const restaurantPayload = {
        name: (form.restaurantName || `${form.name || "My"} Restaurant`).trim(),
        area: form.area?.trim() || null,
        heroUrl: form.heroUrl?.trim() || "https://picsum.photos/1200/400",
      };
      const payload = {
        ...form,
        restaurant: restaurantPayload,
      };
      const res = await api.post("/auth/owner/register", payload);
      if (res.status < 200 || res.status >= 300) throw new Error("Sign up failed");
      navigate("/owner/portal", { replace: true });
    } catch (e2) {
      setErr(e2?.response?.data?.error || e2.message || "Sign up failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="row justify-content-center">
      <div className="col-12 col-lg-8">
        <h2 className="mb-3">Owner sign up</h2>
        {err && <div className="alert alert-danger">{err}</div>}
        <form onSubmit={onSubmit} className="row g-3">
          <div className="col-md-4">
            <label className="form-label">Your name</label>
            <input className="form-control" value={form.name} onChange={(e)=>set("name", e.target.value)} required />
          </div>
          <div className="col-md-4">
            <label className="form-label">Email</label>
            <input type="email" className="form-control" value={form.email} onChange={(e)=>set("email", e.target.value)} required />
          </div>
          <div className="col-md-4">
            <label className="form-label">Password</label>
            <input type="password" className="form-control" value={form.password} onChange={(e)=>set("password", e.target.value)} required minLength={6} />
          </div>

          <div className="col-md-6">
            <label className="form-label">Restaurant name</label>
            <input className="form-control" value={form.restaurantName} onChange={(e)=>set("restaurantName", e.target.value)} placeholder="e.g. FoodAble Deli" />
          </div>
          <div className="col-md-3">
            <label className="form-label">Area/Suburb</label>
            <input className="form-control" value={form.area} onChange={(e)=>set("area", e.target.value)} placeholder="Fortitude Valley" />
          </div>
          <div className="col-md-3">
            <label className="form-label">Hero image URL</label>
            <input className="form-control" value={form.heroUrl} onChange={(e)=>set("heroUrl", e.target.value)} placeholder="https://..." />
          </div>

          <div className="col-12">
            <button className="btn btn-dark" disabled={busy}>{busy ? "Creating…" : "Create owner account"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
