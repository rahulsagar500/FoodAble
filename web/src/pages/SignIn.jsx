import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";

export default function SignIn() {
  const navigate = useNavigate();
  const loc = useLocation();
  const to = new URLSearchParams(loc.search).get("to") || "/";

  const [form, setForm] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  function onChange(e) {
    setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setSaving(true);
    try {
      const res = await fetch("http://localhost:4000/api/auth/customer/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Invalid credentials");
      navigate(to, { replace: true });
    } catch (e2) {
      setErr(e2.message || "Invalid credentials");
    } finally {
      setSaving(false);
    }
  }

  // Starts Google OAuth on the backend; backend redirects back to http://localhost:5173
  function signInWithGoogle() {
    window.location.href = "http://localhost:4000/api/auth/google";
  }

  return (
    <div className="container my-5" style={{ maxWidth: 520 }}>
      <h1 className="h4 mb-3">Sign in</h1>
      {err && <div className="alert alert-danger">{err}</div>}

      {/* Google Sign-In */}
      <button
        type="button"
        onClick={signInWithGoogle}
        className="btn btn-outline-dark w-100 d-flex align-items-center justify-content-center gap-2 mb-3"
      >
        {/* Simple Google "G" SVG */}
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.55 31.676 29.17 35 24 35c-6.075 0-11-4.925-11-11s4.925-11 11-11c2.803 0 5.357 1.064 7.291 2.809l5.657-5.657C33.64 7.14 29.053 5 24 5 12.954 5 4 13.954 4 25s8.954 20 20 20 20-8.954 20-20c0-1.341-.138-2.65-.389-3.917z"/>
          <path fill="#FF3D00" d="M6.306 14.691l6.571 4.818C14.52 16.303 18.879 13 24 13c2.803 0 5.357 1.064 7.291 2.809l5.657-5.657C33.64 7.14 29.053 5 24 5 16.318 5 9.784 9.337 6.306 14.691z"/>
          <path fill="#4CAF50" d="M24 45c5.09 0 9.63-1.932 13.09-5.09l-6.047-4.953C29.223 36.986 26.76 38 24 38c-5.135 0-9.496-3.338-11.086-7.977l-6.566 5.058C9.796 41.64 16.403 45 24 45z"/>
          <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-1.009 3.094-3.18 5.553-5.96 6.957l.001-.001 6.047 4.953C37.018 36.884 40 31.5 40 25c0-1.341-.138-2.65-.389-3.917z"/>
        </svg>
        Continue with Google
      </button>

      {/* Email + password form */}
      <form className="card p-3 shadow-sm" onSubmit={onSubmit}>
        <div className="mb-3">
          <label className="form-label">Email</label>
          <input
            type="email"
            className="form-control"
            name="email"
            value={form.email}
            onChange={onChange}
            required
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Password</label>
          <input
            type="password"
            className="form-control"
            name="password"
            value={form.password}
            onChange={onChange}
            required
          />
        </div>

        <button className="btn btn-dark w-100" disabled={saving}>
          {saving ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="mt-3">
        New here? <Link to="/signup">Create an account</Link>
      </div>
    </div>
  );
}
