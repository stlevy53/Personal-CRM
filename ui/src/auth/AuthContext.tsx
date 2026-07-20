import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { parseJwtPayload } from "./jwt";
import { buildAuthUrl, refreshTokens as oidcRefresh, revokeToken } from "./oidc";
import { generateCodeChallenge, generateCodeVerifier } from "./pkce";
import { clearTokens, loadTokens, saveTokens, type TokenSet } from "./tokens";

/**
 * When VITE_ACME_AUTH_ISSUER is empty the UI runs in dev-bypass mode:
 * a synthetic local user is injected and no OIDC redirect occurs.
 * Mirrors the API's ACME_AUTH_JWKS_URL bypass pattern.
 */
const AUTH_ENABLED = !!(import.meta.env.VITE_ACME_AUTH_ISSUER as string | undefined);

export interface AuthUser {
  sub: string;
  email: string;
  name: string;
  groups: string[];
  initials: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login(): Promise<void>;
  logout(): Promise<void>;
  getAccessToken(): Promise<string | null>;
}

const AuthCtx = createContext<AuthContextValue | null>(null);

const DEV_USER: AuthUser = {
  sub: "local-dev",
  email: "dev@acme.example.com",
  name: "Local Dev",
  groups: [],
  initials: "LD",
};

// No-op bypass used for local dev when VITE_ACME_AUTH_ISSUER is unset.
const DEV_CONTEXT: AuthContextValue = {
  user: DEV_USER,
  isAuthenticated: true,
  isLoading: false,
  login: async () => {},
  logout: async () => {},
  getAccessToken: async () => null,
};

function userFromToken(token: string): AuthUser | null {
  const claims = parseJwtPayload(token);
  if (!claims.sub) return null;
  const displayName = String(claims.name ?? claims.email ?? claims.sub).trim();
  const parts = displayName.split(/\s+/);
  const initials =
    parts.length > 1
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : displayName.slice(0, 2).toUpperCase();
  return {
    sub: claims.sub,
    email: claims.email ?? "",
    name: displayName,
    groups: Array.isArray(claims.groups) ? (claims.groups as string[]) : [],
    initials,
  };
}

/** Full OIDC provider — only mounted when AUTH_ENABLED is true. */
function OidcProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRefresh = useCallback(
    (tokens: TokenSet) => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      // Fire 45 s before expiry; skip if already within that window.
      const delay = tokens.expiresAt - Date.now() - 45_000;
      if (delay <= 0) return;
      refreshTimer.current = setTimeout(async () => {
        try {
          const fresh = await oidcRefresh(tokens.refreshToken);
          saveTokens(fresh);
          setUser(userFromToken(fresh.accessToken));
          scheduleRefresh(fresh);
        } catch {
          clearTokens();
          setUser(null);
          window.location.href = "/login";
        }
      }, delay);
    },
    // scheduleRefresh is referentially stable; the ref handles cleanup internally.
    []
  );

  // Hydrate from sessionStorage on first mount.
  useEffect(() => {
    const tokens = loadTokens();
    if (tokens) {
      setUser(userFromToken(tokens.accessToken));
      scheduleRefresh(tokens);
    }
    setIsLoading(false);
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [scheduleRefresh]);

  const login = useCallback(async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    // Use a second random string as the state nonce.
    const state = generateCodeVerifier();
    sessionStorage.setItem("crm_pkce_verifier", verifier);
    sessionStorage.setItem("crm_auth_state", state);
    // Remember where the user was headed so we can restore it after login.
    sessionStorage.setItem(
      "crm_pre_auth_path",
      window.location.pathname + window.location.search
    );
    window.location.href = buildAuthUrl(challenge, state);
  }, []);

  const logout = useCallback(async () => {
    const tokens = loadTokens();
    if (tokens) await revokeToken(tokens.refreshToken);
    clearTokens();
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    setUser(null);
    window.location.href = "/login";
  }, []);

  /**
   * Returns a valid access token, refreshing proactively if it expires within
   * 60 s. Returns null if the user is not authenticated.
   */
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    let tokens = loadTokens();
    if (!tokens) return null;
    if (tokens.expiresAt - Date.now() < 60_000) {
      try {
        const fresh = await oidcRefresh(tokens.refreshToken);
        saveTokens(fresh);
        setUser(userFromToken(fresh.accessToken));
        scheduleRefresh(fresh);
        tokens = fresh;
      } catch {
        clearTokens();
        setUser(null);
        return null;
      }
    }
    return tokens.accessToken;
  }, [scheduleRefresh]);

  return (
    <AuthCtx.Provider
      value={{ user, isAuthenticated: user !== null, isLoading, login, logout, getAccessToken }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

/**
 * AuthProvider selects between full OIDC and dev-bypass based on whether
 * VITE_ACME_AUTH_ISSUER is configured. AUTH_ENABLED is a build-time constant
 * so the branch never changes at runtime — no Rules of Hooks violation.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  if (!AUTH_ENABLED) {
    return <AuthCtx.Provider value={DEV_CONTEXT}>{children}</AuthCtx.Provider>;
  }
  return <OidcProvider>{children}</OidcProvider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
