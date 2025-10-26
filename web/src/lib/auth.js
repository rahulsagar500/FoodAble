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
  return "/api/auth/google";
}

export async function logout() {
  await api.post("/auth/logout");
}

// ----- email/password auth helpers aligned to monolith -----
export async function registerCustomer({ email, password, name }) {
  const { data } = await api.post("/auth/customer/register", { email, password, name });
  return data;
}

export async function loginCustomer({ email, password }) {
  const { data } = await api.post("/auth/customer/login", { email, password });
  return data;
}

export async function registerOwner({ email, password, name, restaurant }) {
  const { data } = await api.post("/auth/owner/register", { email, password, name, restaurant });
  return data;
}

export async function loginOwner({ email, password }) {
  const { data } = await api.post("/auth/owner/login", { email, password });
  return data;
}
