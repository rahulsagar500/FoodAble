// web/src/lib/auth.js
import { api } from "./api";

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
