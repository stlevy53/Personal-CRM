import type {
  AppStatus,
  AuditEntry,
  Contact,
  Customer,
  Interaction,
  Person,
  Pod,
  Stats,
  Studio,
  Subdivision,
} from "./types";
import { refreshTokens } from "../auth/oidc";
import { clearTokens, loadTokens, saveTokens } from "../auth/tokens";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

/**
 * Returns a valid access token, refreshing proactively if it expires within
 * 60 s. Returns null when unauthenticated (dev bypass or not yet logged in).
 */
async function getAccessToken(): Promise<string | null> {
  let tokens = loadTokens();
  if (!tokens) return null;
  if (tokens.expiresAt - Date.now() < 60_000) {
    try {
      const fresh = await refreshTokens(tokens.refreshToken);
      saveTokens(fresh);
      tokens = fresh;
    } catch {
      clearTokens();
      return null;
    }
  }
  return tokens.accessToken;
}

function redirectToLogin() {
  // Avoid redirect loops if we're already on an auth-related page.
  if (!window.location.pathname.startsWith("/login") &&
      !window.location.pathname.startsWith("/callback")) {
    window.location.href = "/login";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();

  const buildHeaders = (t: string | null) => ({
    "Content-Type": "application/json",
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
    ...options.headers,
  });

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: buildHeaders(token),
  });

  // On 401, attempt a single token refresh before giving up.
  if (res.status === 401) {
    const stored = loadTokens();
    if (stored) {
      try {
        const fresh = await refreshTokens(stored.refreshToken);
        saveTokens(fresh);
        const retry = await fetch(`${API_URL}${path}`, {
          ...options,
          headers: buildHeaders(fresh.accessToken),
        });
        if (retry.status === 401) {
          clearTokens();
          redirectToLogin();
          throw new Error("Session expired. Redirecting to login.");
        }
        if (!retry.ok) {
          let detail = "";
          try { detail = (await retry.json())?.error ?? ""; } catch { /* ignore */ }
          throw new Error(`API ${retry.status}${detail ? `: ${detail}` : ""}`);
        }
        if (retry.status === 204) return undefined as T;
        return retry.json() as Promise<T>;
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("Session expired")) throw e;
        clearTokens();
        redirectToLogin();
        throw new Error("Authentication failed.");
      }
    }
    clearTokens();
    redirectToLogin();
    throw new Error("Not authenticated.");
  }

  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json())?.error ?? "";
    } catch {
      /* ignore */
    }
    throw new Error(`API ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// CRM mirrors the prototype's CRM.* namespaces, backed by the real API.
export const CRM = {
  health: () => request<{ status: string; authEnabled: boolean }>("/healthz"),

  customers: {
    list: () => request<Customer[]>("/api/customers"),
    get: (id: string) => request<Customer>(`/api/customers/${id}`),
    create: (data: Partial<Customer>) =>
      request<Customer>("/api/customers", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Customer>) =>
      request<Customer>(`/api/customers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    addNote: (id: string, text: string, authorId: string) =>
      request<Customer>(`/api/customers/${id}/notes`, {
        method: "POST",
        body: JSON.stringify({ text, authorId }),
      }),
  },

  contacts: {
    list: () => request<Contact[]>("/api/contacts"),
    create: (data: Partial<Contact>) =>
      request<Contact>("/api/contacts", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Contact>) =>
      request<Contact>(`/api/contacts/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  },

  interactions: {
    list: (gameTeamId?: string) =>
      request<Interaction[]>(`/api/interactions${gameTeamId ? `?gameTeamId=${gameTeamId}` : ""}`),
    get: (id: string) => request<Interaction>(`/api/interactions/${id}`),
    create: (data: Partial<Interaction>) =>
      request<Interaction>("/api/interactions", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Interaction>) =>
      request<Interaction>(`/api/interactions/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    setActionStatus: (id: string, index: number, status: string) =>
      request<Interaction>(`/api/interactions/${id}/action-items/${index}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
  },

  subdivisions: {
    list: () => request<Subdivision[]>("/api/subdivisions"),
    create: (name: string) =>
      request<Subdivision>("/api/subdivisions", { method: "POST", body: JSON.stringify({ name }) }),
  },
  studios: {
    list: () => request<Studio[]>("/api/studios"),
    create: (name: string, subdivisionId: string) =>
      request<Studio>("/api/studios", {
        method: "POST",
        body: JSON.stringify({ name, subdivisionId }),
      }),
  },
  appStatuses: {
    list: () => request<AppStatus[]>("/api/app-statuses"),
    create: (name: string) =>
      request<AppStatus>("/api/app-statuses", { method: "POST", body: JSON.stringify({ name }) }),
  },
  people: {
    list: () => request<Person[]>("/api/people"),
    create: (name: string) =>
      request<Person>("/api/people", { method: "POST", body: JSON.stringify({ name }) }),
  },
  pods: { list: () => request<Pod[]>("/api/pods") },
  audit: { list: () => request<AuditEntry[]>("/api/audit") },
  stats: { get: () => request<Stats>("/api/stats") },
};
