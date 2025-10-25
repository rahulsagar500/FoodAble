// web/src/lib/auth.js
import { api } from "./api";

// ----- session helpers -----
export async function getMe() {
  try {
    const { data } = await api.get("/auth/me");
    return data; // null or {id,email,role,name,avatarUrl}
  } catch {
    return null;
  }
}

export function loginUrl() {
  return "http://localhost:4000/api/auth/google";
}

export async function logout() {
  await api.post("/auth/logout");
}

// ----- local (email/password) auth -----
export async function registerLocal({ email, password, name, role }) {
  const { data } = await api.post("/auth/register", { email, password, name, role });
  return data; // user object, cookie is set by server
}

export async function loginLocal({ email, password }) {
  const { data } = await api.post("/auth/login", { email, password });
  return data; // user object, cookie is set by server
}
