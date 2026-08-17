import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { Layout } from "./app/Layout";
import { NavProvider, useNav } from "./app/nav";
import { ToastProvider } from "./app/toast";
import { CrmProvider, useCrm } from "./crm/CrmContext";
import { ActivityFeed } from "./screens/ActivityFeed";
import { AISearch } from "./screens/AISearch";
import { AuditLog } from "./screens/AuditLog";
import { CallbackScreen } from "./screens/CallbackScreen";
import { ContactsDirectory } from "./screens/ContactsDirectory";
import { CustomerProfile } from "./screens/CustomerProfile";
import { CustomersDirectory } from "./screens/CustomersDirectory";
import { LogInteraction } from "./screens/LogInteraction";
import { LoginScreen } from "./screens/LoginScreen";
import { Settings } from "./screens/Settings";

function ScreenRouter() {
  const { screen } = useNav();
  switch (screen) {
    case "home":
      return <ActivityFeed />;
    case "log":
      return <LogInteraction />;
    case "ai":
      return <AISearch />;
    case "s06":
      return <CustomersDirectory />;
    case "s05":
      return <CustomerProfile />;
    case "contacts":
      return <ContactsDirectory />;
    case "settings":
      return <Settings />;
    case "s09":
      return <AuditLog />;
    default:
      return <ActivityFeed />;
  }
}

function Shell() {
  const { loading, error } = useCrm();
  if (loading) return <div className="app-loading">Loading Personal-CRM…</div>;
  if (error)
    return (
      <div className="app-loading">
        Could not reach the API: {error}. Is the backend running?
      </div>
    );
  return (
    <NavProvider>
      <Layout>
        <ScreenRouter />
      </Layout>
    </NavProvider>
  );
}

/**
 * Handles three mutually exclusive top-level states:
 *   /callback  — OIDC redirect landing; exchange code and navigate away
 *   unauthenticated — show login page
 *   authenticated  — render the full app shell
 */
function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const path = window.location.pathname;

  if (path === "/callback") return <CallbackScreen />;
  if (isLoading) return <div className="app-loading">Loading…</div>;
  if (!isAuthenticated) return <LoginScreen />;
  return <>{children}</>;
}

export function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AuthGate>
          <CrmProvider>
            <Shell />
          </CrmProvider>
        </AuthGate>
      </ToastProvider>
    </AuthProvider>
  );
}
