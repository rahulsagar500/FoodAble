// src/lib/api.js
import axios from "axios";

export const api = axios.create({
  baseURL: "http://localhost:4000/api",
  withCredentials: true, // fine even without auth yet
});
