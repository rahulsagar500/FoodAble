// src/pages/SignUp.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";

export default function SignUp() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  function setField(k, v) { setForm((s) => ({ ...s, [k]: v })); }

  async function onSubmit(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const res = await api.post("/auth/customer/register", form);
      if (res.status < 200 || res.status >= 300) throw new Error("Sign up failed");
      navigate("/", { replace: true });
    } catch (e2) {
      const code = e2?.response?.data?.error || e2?.response?.data?.code;
      if (code === "already_authenticated") return navigate("/", { replace: true });
      if (code === "email_in_use") setErr("That email is already in use. Try signing in instead.");
      else if (code === "validation_error") setErr("Please check your name, email and password.");
      else setErr(e2.message || "Sign up failed");
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
            <input className="form-control" value={form.name} onChange={(e)=>setField("name", e.target.value)} required />
          </div>
          <div>
            <label className="form-label">Email</label>
            <input type="email" className="form-control" value={form.email} onChange={(e)=>setField("email", e.target.value)} required />
          </div>
          <div>
            <label className="form-label">Password</label>
            <input type="password" className="form-control" value={form.password} onChange={(e)=>setField("password", e.target.value)} required minLength={6} />
          </div>
          <button className="btn btn-dark w-100" disabled={busy}>
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
