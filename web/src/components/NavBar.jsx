// src/components/NavBar.jsx
import React from "react";
import { NavLink, Link, useLocation } from "react-router-dom";

export default function NavBar() {
  const loc = useLocation();
  const ownerActive = loc.pathname.startsWith("/owner");

  return (
    <nav className="navbar navbar-expand-lg bg-white border-bottom sticky-top shadow-sm">
      <div className="container">
        {/* Brand → Home (Restaurants) */}
        <Link className="navbar-brand d-flex align-items-center gap-2 fw-bold" to="/">
          <span className="brand-dot" aria-hidden="true" />
          <span>FoodAble</span>
        </Link>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#mainNav"
          aria-controls="mainNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div className="collapse navbar-collapse" id="mainNav">
          {/* Left side now empty (no Explore/Restaurants) */}
          <ul className="navbar-nav me-auto mb-2 mb-lg-0" />

          {/* Right side */}
          <ul className="navbar-nav ms-auto mb-2 mb-lg-0 align-items-lg-center">
            <li className="nav-item me-lg-2">
              <NavLink
                to="/cart"
                className={({ isActive }) =>
                  "nav-link navlink-underline d-flex align-items-center gap-1" +
                  (isActive ? " active" : "")
                }
              >
                <span role="img" aria-label="cart">🛒</span>
                <span>Cart</span>
              </NavLink>
            </li>
            <li className="nav-item me-lg-2">
              <NavLink
                to="/signin"
                className={({ isActive }) =>
                  "nav-link navlink-underline" + (isActive ? " active" : "")
                }
              >
                Sign in
              </NavLink>
            </li>
            <li className="nav-item me-lg-3">
              <NavLink
                to="/signup"
                className={({ isActive }) =>
                  "nav-link navlink-underline" + (isActive ? " active" : "")
                }
              >
                Sign up
              </NavLink>
            </li>

            {/* Owner dropdown */}
            <li className="nav-item dropdown">
              <a
                className={"nav-link dropdown-toggle" + (ownerActive ? " active" : "")}
                href="#"
                role="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                For restaurants
              </a>
              <ul className="dropdown-menu dropdown-menu-end shadow-sm">
                <li><Link className="dropdown-item" to="/owner/login">Owner sign in</Link></li>
                <li><Link className="dropdown-item" to="/owner/signup">Owner sign up</Link></li>
                <li><hr className="dropdown-divider" /></li>
                <li>
                  <Link
                    className="dropdown-item d-flex justify-content-between align-items-center"
                    to="/owner/portal"
                  >
                    Owner portal <span className="badge text-bg-light">Dashboard</span>
                  </Link>
                </li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}
