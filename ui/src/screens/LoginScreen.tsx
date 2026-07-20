import { useAuth } from "../auth/AuthContext";

export function LoginScreen() {
  const { login } = useAuth();

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <span className="brand-mark">P</span>
          <span className="brand-name">
            Personal <span className="dim">CRM</span>
          </span>
        </div>
        <h1 className="login-title">Welcome back</h1>
        <p className="login-subtitle">
          Sign in to access your relationship intelligence platform.
        </p>
        <button className="btn btn-primary login-btn" onClick={login}>
          Sign in
        </button>
      </div>
    </div>
  );
}
