import { useEffect, useState } from "react";
import { exchangeCode } from "../auth/oidc";
import { saveTokens } from "../auth/tokens";

export function CallbackScreen() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const errorParam = params.get("error");

      if (errorParam) {
        const desc = params.get("error_description") ?? errorParam;
        setError(`Acme Auth returned an error: ${desc}`);
        return;
      }

      const code = params.get("code");
      const state = params.get("state");

      if (!code) {
        setError("No authorization code received from Acme Auth.");
        return;
      }

      const verifier = sessionStorage.getItem("crm_pkce_verifier");
      const savedState = sessionStorage.getItem("crm_auth_state");

      if (!verifier) {
        setError("PKCE verifier missing — please sign in again.");
        return;
      }

      if (state && savedState && state !== savedState) {
        setError("State mismatch (possible CSRF) — please sign in again.");
        return;
      }

      try {
        const tokens = await exchangeCode(code, verifier);
        saveTokens(tokens);
        sessionStorage.removeItem("crm_pkce_verifier");
        sessionStorage.removeItem("crm_auth_state");

        const destination = sessionStorage.getItem("crm_pre_auth_path") || "/";
        sessionStorage.removeItem("crm_pre_auth_path");

        // Navigate to the original destination; the page reload lets
        // AuthProvider hydrate cleanly from sessionStorage.
        window.location.replace(destination);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error during sign-in.");
      }
    })();
    // Run once on mount only.
  }, []);

  if (error) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo">
            <span className="brand-mark">P</span>
            <span className="brand-name">
              Personal <span className="dim">CRM</span>
            </span>
          </div>
          <h2 className="login-title" style={{ color: "var(--crit)" }}>
            Sign-in failed
          </h2>
          <p className="login-subtitle">{error}</p>
          <a href="/login" className="btn btn-primary login-btn">
            Try again
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <span className="brand-mark">P</span>
          <span className="brand-name">
            Personal <span className="dim">CRM</span>
          </span>
        </div>
        <p className="login-subtitle">Completing sign-in…</p>
      </div>
    </div>
  );
}
