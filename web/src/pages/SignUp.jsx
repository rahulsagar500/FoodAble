import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

export default function SignUp() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  function set(k, v) { setForm((s) => ({ ...s, [k]: v })); }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const res = await fetch("http://localhost:4000/api/auth/customer/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Sign up failed");
      navigate("/", { replace: true });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="row justify-content-center">
      <div className="col-12 col-md-6 col-lg-5">
        <h2 className="mb-3">Create your account</h2>
        {err && <div className="alert alert-danger">{err}</div>}
        <form onSubmit={onSubmit} className="vstack gap-3">
          <div>
            <label className="form-label">Name</label>
            <input className="form-control" value={form.name} onChange={(e)=>set("name", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Email</label>
            <input type="email" className="form-control" required value={form.email} onChange={(e)=>set("email", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Password</label>
            <input type="password" className="form-control" required value={form.password} onChange={(e)=>set("password", e.target.value)} />
          </div>
          <button className="btn btn-dark" disabled={busy}>
            {busy ? "Creating…" : "Sign up"}
          </button>
          <p className="text-muted small mb-0">
            Already have an account? <Link to="/signin">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
