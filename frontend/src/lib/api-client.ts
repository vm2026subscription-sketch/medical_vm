// Thin fetch wrapper around the MedPath backend (see /backend). Handles the base URL,
// JSON encode/decode, attaching the bearer access token, and a single silent
// refresh-and-retry when a request comes back 401.

import { BRAND } from "./brand";

const PUBLIC_API_URL =
  (typeof import.meta !== "undefined" && import.meta.env["VITE_API_URL"]) ||
  (import.meta.env.PROD ? `${BRAND.siteUrl}/api/v1` : "http://localhost:5000/api/v1");
const API_URL = import.meta.env.SSR
  ? process.env["INTERNAL_API_URL"] || PUBLIC_API_URL
  : PUBLIC_API_URL;

const ACCESS_TOKEN_KEY = "medpath.accessToken";
const REFRESH_TOKEN_KEY = "medpath.refreshToken";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.dispatchEvent(new Event("medpath:logout"));
}

export class ApiClientError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean; // attach Authorization header if a token exists (default true)
  isRetry?: boolean; // internal — prevents infinite refresh loops
}

let refreshInFlight: Promise<boolean> | null = null;
async function performRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) return false;
      throw new ApiClientError(
        res.status,
        "Session refresh is temporarily unavailable. Please retry.",
      );
    }
    const json = await res.json();
    if (getRefreshToken() !== refreshToken) return false;
    setTokens(json.data.accessToken, json.data.refreshToken);
    return true;
  } catch (error) {
    if (error instanceof ApiClientError) throw error;
    throw new ApiClientError(0, "Cannot reach the server. Please retry.");
  }
}

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight)
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, auth = true, isRetry = false } = options;

  const multipart = typeof FormData !== "undefined" && body instanceof FormData;
  const headers: Record<string, string> = multipart ? {} : { "Content-Type": "application/json" };
  if (auth) {
    const token = getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    const init: RequestInit = { method, headers };
    if (method === "GET") init.cache = "no-store";
    if (body !== undefined) init.body = multipart ? (body as FormData) : JSON.stringify(body);
    res = await fetch(`${API_URL}${path}`, init);
  } catch (err) {
    throw new ApiClientError(0, "Network error — is the MedPath API running?", err);
  }

  // One silent refresh-and-retry on an expired access token.
  if (res.status === 401 && auth && !isRetry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiRequest<T>(path, { ...options, isRetry: true });
    }
    clearTokens();
  }
  if (res.status === 401 && auth && isRetry) clearTokens();

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiClientError(
      res.status,
      json.message || `Request failed (${res.status})`,
      json.details,
    );
  }

  return json as T;
}

export function apiUpload<T = unknown>(path: string, formData: FormData): Promise<T> {
  return apiRequest<T>(path, { method: "POST", body: formData });
}

export { API_URL };
