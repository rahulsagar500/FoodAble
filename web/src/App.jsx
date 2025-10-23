import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import Explore from "./pages/Explore";
import OfferDetails from "./pages/OfferDetails";
import Restaurants from "./pages/Restaurants";
import RestaurantDetails from "./pages/RestaurantDetails";
import RestaurantPortal from "./pages/RestaurantPortal";

export default function App() {
  return (
    <div>
      <nav className="navbar navbar-light bg-light border-bottom">
        <div className="container d-flex justify-content-between align-items-center py-2">
          <Link className="navbar-brand fw-semibold m-0" to="/">FoodAble</Link>
          <div className="d-flex gap-2">
            <Link className="btn btn-outline-secondary" to="/restaurants">Restaurants</Link>
            <Link className="btn btn-outline-dark" to="/portal">For Restaurants</Link>
          </div>
        </div>
      </nav>

      <main>
        <Routes>
          <Route path="/" element={<Explore />} />
          <Route path="/offers/:id" element={<OfferDetails />} />
          <Route path="/restaurants" element={<Restaurants />} />
          <Route path="/restaurants/:id" element={<RestaurantDetails />} />
          <Route path="/portal" element={<RestaurantPortal />} />
          <Route path="*" element={<div className="container my-5 text-muted">Page not found</div>} />
        </Routes>
      </main>
    </div>
  );
}
