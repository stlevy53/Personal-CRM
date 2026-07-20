import { useEffect, type ReactNode } from "react";
import { Icon } from "./icons";

interface ModalProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  size?: "sm";
  onClose: () => void;
  onSubmit?: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({
  title,
  subtitle,
  badge,
  size,
  onClose,
  onSubmit,
  children,
  footer,
}: ModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && onSubmit) {
        e.preventDefault();
        onSubmit();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, onSubmit]);

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${size === "sm" ? " modal-sm" : ""}`}>
        <div className="modal-header">
          {badge}
          <div className="modal-title">
            {title}
            {subtitle && <div className="sub">{subtitle}</div>}
          </div>
          <button className="modal-close" onClick={onClose} title="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && (
          <div className="modal-footer">
            {onSubmit && (
              <span className="hintkbd">
                <kbd>⌘</kbd>
                <kbd>↵</kbd> to save · <kbd>Esc</kbd> to close
              </span>
            )}
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
