import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

export default function OwnerLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const res = await api.post("/auth/owner/login", { email, password });
      if (res.status < 200 || res.status >= 300) throw new Error("Login failed");
      navigate("/owner/portal", { replace: true });
    } catch (e) { setErr(e?.response?.data?.message || e.message || "Login failed"); } finally { setBusy(false); }
  }

  return (
    <div className="row justify-content-center">
      <div className="col-12 col-md-6 col-lg-5">
        <h2 className="mb-3">Owner sign in</h2>
        {err && <div className="alert alert-danger">{err}</div>}
        <form onSubmit={onSubmit} className="vstack gap-3">
          <div>
            <label className="form-label">Email</label>
            <input className="form-control" type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Password</label>
            <input className="form-control" type="password" required value={password} onChange={(e)=>setPassword(e.target.value)} />
          </div>
          <button className="btn btn-dark" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
