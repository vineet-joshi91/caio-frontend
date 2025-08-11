// src/lib/auth.ts
export const getToken = () =>
  typeof window === "undefined" ? null : localStorage.getItem("token");

export const setToken = (t: string) => {
  if (typeof window !== "undefined") localStorage.setItem("token", t);
};

export const clearToken = () => {
  if (typeof window !== "undefined") localStorage.removeItem("token");
};
