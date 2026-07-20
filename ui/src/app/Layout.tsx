import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { useCrm } from "../crm/CrmContext";
import { Icon, type IconName } from "./icons";
import { NAV_FOR, useNav, type Screen } from "./nav";

interface NavItem {
  id: string;
  label: string;
  screen: Screen;
  icon: IconName;
  count?: number;
  onClick?: () => void;
}

interface NavSection {
  section: string;
  items: NavItem[];
}

export function Layout({ children }: { children: ReactNode }) {
  const { screen, navigate } = useNav();
  const { user, logout } = useAuth();
  const crm = useCrm();
  const active = NAV_FOR[screen];

  const sections: NavSection[] = [
    {
      section: "Workspace",
      items: [
        { id: "home", label: "Activity Feed", screen: "home", icon: "feed" },
        {
          id: "log",
          label: "Log Interaction",
          screen: "log",
          icon: "log",
          onClick: () => navigate("log", { editingInteractionId: null }),
        },
        { id: "ai", label: "AI Search", screen: "ai", icon: "ai" },
      ],
    },
    {
      section: "Relationships",
      items: [
        { id: "s06", label: "Customers", screen: "s06", icon: "customers", count: crm.customers.length },
        { id: "contacts", label: "Contacts", screen: "contacts", icon: "contacts", count: crm.contacts.length },
      ],
    },
    {
      section: "Admin",
      items: [
        { id: "settings", label: "Settings", screen: "settings", icon: "settings" },
        { id: "s09", label: "Audit Log", screen: "s09", icon: "audit" },
      ],
    },
  ];

  return (
    <>
      <header className="topbar">
        <button className="brand" onClick={() => navigate("home")}>
          <img src="/favicon.png" alt="Personal-CRM" className="brand-mark" />
          <span className="brand-name">
            Personal <span className="dim">CRM</span>
          </span>
        </button>

        <button className="topbar-search" onClick={() => navigate("ai")}>
          <Icon name="search" />
          <span>Search customers, contacts, or ask AI…</span>
          <span className="kbd">⌘K</span>
        </button>

        <div className="topbar-right">
          <button className="icon-btn" title="Notifications">
            <Icon name="bell" />
          </button>
          <div className="avatar" title={user?.name ?? ""}>
            {user?.initials ?? "?"}
          </div>
          <button className="icon-btn" title="Sign out" onClick={logout}>
            <Icon name="logout" />
          </button>
        </div>
      </header>

      <aside className="rail">
        {sections.map((sec) => (
          <div key={sec.section}>
            <div className="rail-section">{sec.section}</div>
            {sec.items.map((it) => (
              <button
                key={it.id}
                className={`nav-item${active === it.id ? " active" : ""}`}
                onClick={it.onClick ?? (() => navigate(it.screen))}
              >
                <Icon name={it.icon} />
                <span>{it.label}</span>
                {it.count !== undefined && <span className="count">{it.count}</span>}
              </button>
            ))}
          </div>
        ))}
        <div className="rail-foot">
          <span className="dot" />
          <span>Connected · live data</span>
        </div>
      </aside>

      <main className="main">{children}</main>
    </>
  );
}
