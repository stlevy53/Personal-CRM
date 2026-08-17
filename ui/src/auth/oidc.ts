import type { TokenSet } from "./tokens";

// Endpoints derived from the Acme Auth discovery document at
// https://auth.acme.example.com/.well-known/openid-configuration
// The revoke endpoint was specified explicitly; the rest follow the /oauth/* pattern.
const ISSUER =
  (import.meta.env.VITE_ACME_AUTH_ISSUER as string | undefined) ??
  "https://auth.acme.example.com";

const CLIENT_ID =
  (import.meta.env.VITE_ACME_AUTH_CLIENT_ID as string | undefined) ??
  "personal-crm-local";

const SCOPES = "openid profile email groups offline_access";

const AUTH_ENDPOINT = `${ISSUER}/oauth/authorize`;
const TOKEN_ENDPOINT = `${ISSUER}/oauth/token`;
const REVOKE_ENDPOINT = `${ISSUER}/oauth/revoke`;

/** The redirect URI registered with Acme Auth for this client. */
export const redirectUri = (): string => `${window.location.origin}/callback`;

export function buildAuthUrl(codeChallenge: string, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(),
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export async function exchangeCode(code: string, verifier: string): Promise<TokenSet> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      redirect_uri: redirectUri(),
      code,
      code_verifier: verifier,
    }).toString(),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${body}`);
  }
  return toTokenSet(await res.json());
}

export async function refreshTokens(refreshToken: string): Promise<TokenSet> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`Token refresh failed (${res.status})`);
  }
  return toTokenSet(await res.json());
}

/** Best-effort revocation — ignores failures so logout always completes. */
export async function revokeToken(refreshToken: string): Promise<void> {
  try {
    await fetch(REVOKE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        token: refreshToken,
      }).toString(),
    });
  } catch {
    // Network error during revocation should not block logout.
  }
}

function toTokenSet(json: Record<string, unknown>): TokenSet {
  const expiresIn = Number(json.expires_in ?? 3600);
  return {
    accessToken: json.access_token as string,
    refreshToken: json.refresh_token as string,
    expiresAt: Date.now() + expiresIn * 1000,
    idToken: json.id_token as string | undefined,
  };
}
