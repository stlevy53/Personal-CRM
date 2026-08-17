import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Screen =
  | "home"
  | "log"
  | "ai"
  | "s06"
  | "s05"
  | "contacts"
  | "settings"
  | "s09";

export interface NavParams {
  currentTeamId?: string;
  editingInteractionId?: string | null;
}

interface NavState {
  screen: Screen;
  params: NavParams;
  navigate: (screen: Screen, params?: NavParams) => void;
}

const NavCtx = createContext<NavState | null>(null);

// Which sidebar item to highlight for a given screen (sub-screens map to parent).
export const NAV_FOR: Record<Screen, string> = {
  home: "home",
  log: "log",
  ai: "ai",
  s06: "s06",
  s05: "s06",
  contacts: "contacts",
  settings: "settings",
  s09: "s09",
};

export function NavProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<Screen>("home");
  const [params, setParams] = useState<NavParams>({});

  const value = useMemo<NavState>(
    () => ({
      screen,
      params,
      navigate: (next, p = {}) => {
        setScreen(next);
        setParams(p);
        window.scrollTo(0, 0);
      },
    }),
    [screen, params]
  );

  return <NavCtx.Provider value={value}>{children}</NavCtx.Provider>;
}

export function useNav(): NavState {
  const ctx = useContext(NavCtx);
  if (!ctx) throw new Error("useNav must be used within NavProvider");
  return ctx;
}
