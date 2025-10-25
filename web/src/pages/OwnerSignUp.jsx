import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function OwnerSignUp() {
  const [form, setForm] = useState({
    name: "", email: "", password: "",
    restaurantName: "", area: "", heroUrl: ""
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  function set(k, v) { setForm((s)=>({ ...s, [k]: v })); }

  async function onSubmit(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const res = await fetch("http://localhost:4000/api/auth/owner/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Sign up failed");
      navigate("/owner/portal", { replace: true });
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="row justify-content-center">
      <div className="col-12 col-md-8 col-lg-7">
        <h2 className="mb-3">Owner sign up</h2>
        {err && <div className="alert alert-danger">{err}</div>}
        <form onSubmit={onSubmit} className="row g-3">
          <div className="col-md-6">
            <label className="form-label">Your name</label>
            <input className="form-control" value={form.name} onChange={(e)=>set("name", e.target.value)} />
          </div>
          <div className="col-md-6">
            <label className="form-label">Email</label>
            <input type="email" className="form-control" required value={form.email} onChange={(e)=>set("email", e.target.value)} />
          </div>
          <div className="col-12">
            <label className="form-label">Password</label>
            <input type="password" className="form-control" required value={form.password} onChange={(e)=>set("password", e.target.value)} />
          </div>

          <div className="col-md-6">
            <label className="form-label">Restaurant name</label>
            <input className="form-control" required value={form.restaurantName} onChange={(e)=>set("restaurantName", e.target.value)} />
          </div>
          <div className="col-md-3">
            <label className="form-label">Area/Suburb</label>
            <input className="form-control" value={form.area} onChange={(e)=>set("area", e.target.value)} />
          </div>
          <div className="col-md-3">
            <label className="form-label">Hero image URL</label>
            <input className="form-control" value={form.heroUrl} onChange={(e)=>set("heroUrl", e.target.value)} />
          </div>

          <div className="col-12">
            <button className="btn btn-dark" disabled={busy}>
              {busy ? "Creating…" : "Create owner account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
