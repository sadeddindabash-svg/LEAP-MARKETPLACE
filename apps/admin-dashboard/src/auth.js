// Points at services/api. Override at build time with
// VITE_API_BASE_URL=https://your-deployed-api npm run build
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const TOKEN_STORAGE_KEY = "leap_admin_token";

export function saveToken(token) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}
export function getStoredToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export async function login(email, password) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Login failed");
  return data; // { token, user }
}

export async function getCurrentUser(token) {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Session expired or invalid");
  return response.json();
}
