const P = "crm_auth_";

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  /** ms since epoch when the access token expires */
  expiresAt: number;
  idToken?: string;
}

export function saveTokens(t: TokenSet): void {
  sessionStorage.setItem(P + "access_token", t.accessToken);
  sessionStorage.setItem(P + "refresh_token", t.refreshToken);
  sessionStorage.setItem(P + "expires_at", String(t.expiresAt));
  if (t.idToken) sessionStorage.setItem(P + "id_token", t.idToken);
  else sessionStorage.removeItem(P + "id_token");
}

export function loadTokens(): TokenSet | null {
  const accessToken = sessionStorage.getItem(P + "access_token");
  const refreshToken = sessionStorage.getItem(P + "refresh_token");
  const expiresAtStr = sessionStorage.getItem(P + "expires_at");
  if (!accessToken || !refreshToken || !expiresAtStr) return null;
  return {
    accessToken,
    refreshToken,
    expiresAt: Number(expiresAtStr),
    idToken: sessionStorage.getItem(P + "id_token") ?? undefined,
  };
}

export function clearTokens(): void {
  [
    P + "access_token",
    P + "refresh_token",
    P + "expires_at",
    P + "id_token",
  ].forEach((k) => sessionStorage.removeItem(k));
}
