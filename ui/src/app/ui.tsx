import { useEffect, useRef, useState } from "react";
import { useCrm } from "../crm/CrmContext";
import { interactionTypeMeta, sentimentMeta } from "../crm/helpers";
import { Icon, type IconName } from "./icons";

export function AppStatusBadge({ status }: { status: string }) {
  const { appStatusMeta } = useCrm();
  const meta = appStatusMeta(status);
  return (
    <span className="status" data-s={status}>
      <span className="dot" />
      {meta.label}
    </span>
  );
}

const TYPE_ICONS: Record<string, IconName> = {
  meeting: "meeting",
  call: "call",
  email: "email",
  slack: "slack",
  other: "other",
};

export function InteractionBadge({ type }: { type: string }) {
  const meta = interactionTypeMeta(type);
  return (
    <span className="itype" data-t={type}>
      <Icon name={TYPE_ICONS[type] ?? "other"} />
      {meta.label}
    </span>
  );
}

export function SentimentBadge({ sentiment }: { sentiment: string }) {
  const meta = sentimentMeta(sentiment);
  return (
    <span className="sentiment" data-sm={meta.icon} title={`Sentiment: ${meta.label}`}>
      <Icon name={meta.icon} />
      {meta.label}
    </span>
  );
}

/**
 * Renders interaction notes with preserved formatting (pre-wrap) and an
 * expand/collapse toggle when the content exceeds `clampLines`.
 * Calls e.stopPropagation() so the toggle works inside clickable cards.
 */
export function InteractionNotes({
  text,
  clampLines = 4,
}: {
  text: string;
  clampLines?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      setIsClamped(el.scrollHeight > el.clientHeight + 2);
    });
    return () => cancelAnimationFrame(id);
  }, [text]);

  return (
    <div>
      <p
        ref={ref}
        className={`ix-notes${expanded ? "" : " clamp"}`}
        style={!expanded ? ({ WebkitLineClamp: clampLines } as React.CSSProperties) : undefined}
      >
        {text}
      </p>
      {(isClamped || expanded) && (
        <button
          className="notes-toggle"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

const ACTION_LABELS: Record<string, string> = {
  open: "Open",
  "in-progress": "In Progress",
  closed: "Closed",
};

/** Dot-pill status selector for action items (Open / In Progress / Closed). */
export function ActionStatusMenu({
  value,
  onChange,
}: {
  value: string;
  onChange: (status: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="st-select" ref={ref}>
      <button
        type="button"
        className="st-trigger"
        data-s={value}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <span className="dot" />
        {ACTION_LABELS[value] ?? value}
        <Icon name="chevron" className="chev" />
      </button>
      {open && (
        <div className="st-menu">
          {Object.keys(ACTION_LABELS).map((s) => (
            <div
              key={s}
              className="st-opt"
              data-s={s}
              onClick={(e) => {
                e.stopPropagation();
                onChange(s);
                setOpen(false);
              }}
            >
              <span className="dot" />
              {ACTION_LABELS[s]}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function EmptyState({
  message,
  ctaLabel,
  onCta,
}: {
  message: string;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  return (
    <div className="empty">
      <div className="empty-state-text">{message}</div>
      {ctaLabel && onCta && (
        <button className="btn btn-primary btn-sm" onClick={onCta}>
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
