// src/App.jsx
import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import Layout from "./components/Layout.jsx";

// PAGES
// (Explore removed)
import Restaurants from "./pages/Restaurants.jsx";
import RestaurantDetails from "./pages/RestaurantDetails.jsx";
import OfferDetails from "./pages/OfferDetails.jsx";
import Cart from "./pages/cart.jsx";
import SignIn from "./pages/SignIn.jsx";
import SignUp from "./pages/SignUp.jsx";
import OwnerLoginPage from "./pages/OwnerLoginPage.jsx";
import OwnerSignupPage from "./pages/OwnerSignUp.jsx";
import OwnerPortal from "./pages/OwnerPortal.jsx";

export default function App() {
  return (
    <Layout>
      <Routes>
        {/* Home goes to Restaurants */}
        <Route path="/" element={<Restaurants />} />

        {/* Restaurants */}
        <Route path="/restaurants" element={<Restaurants />} />
        <Route path="/restaurants/:id" element={<RestaurantDetails />} />

        {/* Offers */}
        <Route path="/offers/:id" element={<OfferDetails />} />

        {/* Cart */}
        <Route path="/cart" element={<Cart />} />

        {/* Customer auth */}
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />

        {/* Owner */}
        <Route path="/owner/login" element={<OwnerLoginPage />} />
        <Route path="/owner/signup" element={<OwnerSignupPage />} />
        <Route path="/owner/portal" element={<OwnerPortal />} />

        {/* 404 */}
        <Route
          path="*"
          element={
            <div className="text-center py-5">
              <h3 className="mb-2">404</h3>
              <p className="text-muted">That page doesn’t exist. Head back home.</p>
              <div className="d-flex gap-2 justify-content-center">
                <Link className="btn btn-dark" to="/">Home</Link>
                <Link className="btn btn-outline-secondary" to="/owner/portal">Owner portal</Link>
              </div>
            </div>
          }
        />
      </Routes>
    </Layout>
  );
}
