import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

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
      const res = await fetch("http://localhost:4000/api/auth/owner/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Login failed");
      navigate("/owner/portal", { replace: true });
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
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
