import { useAuth } from "../auth/AuthContext";

export function LoginScreen() {
  const { login } = useAuth();

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <span className="brand-mark">Z</span>
          <span className="brand-name">
            MGT <span className="dim">CRM</span>
          </span>
        </div>
        <h1 className="login-title">Welcome back</h1>
        <p className="login-subtitle">
          Sign in with your Acme Games account to access the MGT Relationship
          Intelligence platform.
        </p>
        <button className="btn btn-primary login-btn" onClick={login}>
          Sign in with Acme Auth
        </button>
        <p className="login-note">Acme Games VPN access is required.</p>
      </div>
    </div>
  );
}
