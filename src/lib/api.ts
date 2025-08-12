// src/lib/api.ts
import axios from "axios";

/** Public base URL for the backend, e.g. https://caio-backend.onrender.com */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "https://caio-backend.onrender.com";

/** Token helpers */
export const getToken = () => (typeof window !== "undefined" ? localStorage.getItem("token") : null);
export const setToken = (t: string) => typeof window !== "undefined" && localStorage.setItem("token", t);
export const clearToken = () => typeof window !== "undefined" && localStorage.removeItem("token");

/** Preconfigured axios instance */
const http = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
});

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      clearToken();
      // Optional: send user back to login
      if (typeof window !== "undefined") window.location.href = "/"; // or "/login"
    }
    return Promise.reject(err);
  }
);

/** Optional convenience login using axios (not required if you use fetch in page.tsx) */
export async function login(username: string, password: string) {
  const res = await http.post(
    "/api/login",
    new URLSearchParams({ username, password }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  return res.data as { access_token: string; token_type: string };
}

export default http;
