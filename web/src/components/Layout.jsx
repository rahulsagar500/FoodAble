// src/components/Layout.jsx
import React from "react";
import NavBar from "./NavBar.jsx";

export default function Layout({ children }) {
  return (
    <>
      <NavBar />
      <main className="container py-4">{children}</main>
      <footer className="border-top mt-5">
        <div className="container small text-muted py-4 d-flex flex-wrap gap-3 justify-content-between">
          <span>© {new Date().getFullYear()} FoodAble</span>
          <span>
            <a className="link-secondary link-underline-opacity-0" href="#">Privacy</a>{" · "}
            <a className="link-secondary link-underline-opacity-0" href="#">Terms</a>{" · "}
            <a className="link-secondary link-underline-opacity-0" href="#">Contact</a>
          </span>
        </div>
      </footer>
    </>
  );
}
