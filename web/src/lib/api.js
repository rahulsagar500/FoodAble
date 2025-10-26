// src/lib/api.js
import axios from "axios";

// Use env when provided, otherwise rely on Vite dev proxy ("/api")
const BASE = import.meta?.env?.VITE_API_BASE || "/api";

export const api = axios.create({
  baseURL: BASE,
  withCredentials: true,
});
