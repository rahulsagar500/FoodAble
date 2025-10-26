// src/components/NavBar.jsx
import React, { useEffect, useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api";

export default function NavBar() {
  const loc = useLocation();
  const navigate = useNavigate();
  const ownerActive = loc.pathname.startsWith("/owner");

  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadMe() {
    try {
      const { data } = await api.get("/auth/me");
      setMe(data && data.id ? data : null);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }

  // on mount + whenever location changes, refresh session
  useEffect(() => { loadMe(); /* eslint-disable-next-line */ }, [loc.pathname]);

  function initialsFrom(name, email) {
    const src = (name && name.trim()) || email || "";
    const parts = src.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return "U";
  }

  async function onLogout(e) {
    e.preventDefault();
    try { await api.post("/auth/logout"); } catch {}
    setMe(null);
    navigate("/", { replace: true });
  }

  return (
    <nav className="navbar navbar-expand-lg bg-white border-bottom sticky-top shadow-sm">
      <div className="container">
        <Link className="navbar-brand d-flex align-items-center gap-2 fw-bold" to="/">
          <span className="brand-dot" aria-hidden="true" />
          <span>FoodAble</span>
        </Link>

        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav"
                aria-controls="mainNav" aria-expanded="false" aria-label="Toggle navigation">
          <span className="navbar-toggler-icon" />
        </button>

        <div className="collapse navbar-collapse" id="mainNav">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0" />

          <ul className="navbar-nav ms-auto mb-2 mb-lg-0 align-items-lg-center">
            <li className="nav-item me-lg-2">
              <NavLink to="/cart" className={({ isActive }) =>
                "nav-link navlink-underline d-flex align-items-center gap-1" + (isActive ? " active" : "")
              }>
                <span role="img" aria-label="cart">🛒</span><span>Cart</span>
              </NavLink>
            </li>

            <li className="nav-item dropdown me-lg-2">
              <a className={"nav-link dropdown-toggle" + (ownerActive ? " active" : "")} href="#"
                 role="button" data-bs-toggle="dropdown" aria-expanded="false">
                For restaurants
              </a>
              <ul className="dropdown-menu dropdown-menu-end shadow-sm">
                <li><Link className="dropdown-item" to="/owner/login">Owner sign in</Link></li>
                <li><Link className="dropdown-item" to="/owner/signup">Owner sign up</Link></li>
                <li><hr className="dropdown-divider" /></li>
                <li>
                  <Link className="dropdown-item d-flex justify-content-between align-items-center" to="/owner/portal">
                    Owner portal <span className="badge text-bg-light">Dashboard</span>
                  </Link>
                </li>
              </ul>
            </li>

            {loading ? (
              <li className="nav-item"><span className="nav-link disabled">Loading…</span></li>
            ) : me ? (
              <li className="nav-item dropdown">
                <a className="nav-link dropdown-toggle d-flex align-items-center gap-2" href="#"
                   role="button" data-bs-toggle="dropdown" aria-expanded="false" title={me.email}>
                  {me.avatarUrl ? (
                    <img src={me.avatarUrl} alt={me.name || me.email} className="avatar-img" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="avatar-chip">{initialsFrom(me.name, me.email)}</span>
                  )}
                  <span className="d-none d-lg-inline">Hi, {me.name || me.email}</span>
                </a>
                <ul className="dropdown-menu dropdown-menu-end shadow-sm">
                  <li className="dropdown-header">Signed in as <strong>{me.name || me.email}</strong></li>
                  <li><hr className="dropdown-divider" /></li>
                  {(me.role === "restaurant" || me.role === "admin") && (
                    <li><Link className="dropdown-item" to="/owner/portal">Owner portal</Link></li>
                  )}
                  <li><button className="dropdown-item text-danger" onClick={onLogout}>Log out</button></li>
                </ul>
              </li>
            ) : (
              <>
                <li className="nav-item me-lg-2">
                  <NavLink to="/signin" className={({ isActive }) => "nav-link navlink-underline" + (isActive ? " active" : "")}>
                    Sign in
                  </NavLink>
                </li>
                <li className="nav-item me-lg-1">
                  <NavLink to="/signup" className={({ isActive }) => "nav-link navlink-underline" + (isActive ? " active" : "")}>
                    Sign up
                  </NavLink>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}
