// src/components/AnonymousRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../lib/api";

/**
 * Renders children only when NOT authenticated.
 * If authenticated, redirects to the given 'to' path (default "/").
 */
export default function AnonymousRoute({ children, to = "/" }) {
  const [me, setMe] = useState(undefined); // undefined = loading, null = not authed, object = authed

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get("/auth/me");
        if (!alive) return;
        setMe(data && data.id ? data : null);
      } catch {
        if (!alive) return;
        setMe(null);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (me === undefined) return null; // or a spinner
  if (me) return <Navigate to={to} replace />;

  return children;
}
