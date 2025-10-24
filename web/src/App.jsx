import React, { useEffect, useState } from "react";
import { Routes, Route, Link, Navigate } from "react-router-dom";
import Restaurants from "./pages/Restaurants";
import RestaurantDetails from "./pages/RestaurantDetails";
import OfferDetails from "./pages/OfferDetails";
import RestaurantPortal from "./pages/RestaurantPortal";
import Cart from "./pages/Cart";
import { useCart } from "./cart/CartContext.jsx";
import { getMe, loginUrl, logout } from "./lib/auth";

export default function App() {
  const { itemCount } = useCart();
  const [me, setMe] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    getMe().then((u) => {
      setMe(u);
      setAuthLoading(false);
    });
  }, []);

  async function onLogout() {
    await logout();
    setMe(null);
  }

  return (
    <div>
      <nav className="navbar navbar-light bg-light border-bottom">
        <div className="container d-flex justify-content-between align-items-center py-2">
          <Link className="navbar-brand fw-semibold m-0" to="/">FoodAble</Link>
          <div className="d-flex align-items-center gap-2">
            <Link className="btn btn-outline-secondary" to="/cart">
              Cart {itemCount > 0 && <span className="badge bg-dark ms-1">{itemCount}</span>}
            </Link>

            {me ? (
              <>
                <span className="text-muted small">Hi, {me.name || me.email}</span>
                <button className="btn btn-outline-secondary" onClick={onLogout}>Logout</button>
              </>
            ) : (
              <a className="btn btn-outline-secondary" href={loginUrl()}>Login with Google</a>
            )}

            <Link className="btn btn-outline-dark" to="/portal">For Restaurants</Link>
          </div>
        </div>
      </nav>

      <main>
        <Routes>
          <Route path="/" element={<Restaurants />} />
          <Route path="/restaurants" element={<Restaurants />} />
          <Route path="/restaurants/:id" element={<RestaurantDetails />} />
          <Route path="/offers/:id" element={<OfferDetails />} />
          <Route path="/cart" element={<Cart />} />
          <Route
            path="/portal"
            element={
              authLoading ? (
                <div className="container my-5 text-muted">Checking login…</div>
              ) : me ? (
                <RestaurantPortal />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route path="*" element={<div className="container my-5 text-muted">Page not found</div>} />
        </Routes>
      </main>
    </div>
  );
}
