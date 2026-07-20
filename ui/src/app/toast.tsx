import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";

export type ToastType = "green" | "blue" | "amber" | "red";

const TOAST_ICON: Record<ToastType, IconName> = {
  green: "check",
  blue: "ai",
  amber: "clock",
  red: "clock",
};

interface ToastItem {
  id: number;
  msg: string;
  type: ToastType;
}

interface ToastApi {
  showToast: (msg: string, type?: ToastType) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const showToast = useCallback(
    (msg: string, type: ToastType = "green") => {
      const id = ++seq;
      setToasts((t) => [...t, { id, msg, type }]);
      setTimeout(() => remove(id), 4500);
    },
    [remove]
  );

  return (
    <ToastCtx.Provider value={{ showToast }}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`} onClick={() => remove(t.id)}>
            <span className="ic">
              <Icon name={TOAST_ICON[t.type]} />
            </span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
