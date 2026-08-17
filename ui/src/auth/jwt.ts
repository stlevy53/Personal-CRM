export interface JwtClaims {
  sub?: string;
  email?: string;
  name?: string;
  groups?: string[];
  exp?: number;
  [key: string]: unknown;
}

/**
 * Decodes the payload of a JWT without verification.
 * Used only to extract display claims (email, name, groups) from a token
 * that has already been validated server-side or is being trusted after
 * a successful OIDC exchange.
 */
export function parseJwtPayload(token: string): JwtClaims {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return {};
    // base64url → standard base64, then pad to multiple of 4
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "==".slice(0, (4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded)) as JwtClaims;
  } catch {
    return {};
  }
}
