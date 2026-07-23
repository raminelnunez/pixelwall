/** Empty string → same-origin (Vite proxy in dev). */
export function apiBase(): string {
  return (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";
}

export function socketUrl(): string {
  const fromEnv = (import.meta.env.VITE_SOCKET_URL as string | undefined)?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return apiBase() || window.location.origin;
}
