import { useMemo, useRef, useState } from "react";

export interface PickerOption {
  id: string;
  name: string;
  hint?: string;
}

export interface SelectedChip {
  id: string;
  name: string;
  isNew?: boolean;
}

interface Props {
  selected: SelectedChip[];
  options: PickerOption[];
  onAdd: (opt: PickerOption) => void;
  onRemove: (id: string) => void;
  onCreate?: (name: string) => void;
  createHint?: string;
  placeholder?: string;
  disabled?: boolean;
  disabledMessage?: string;
}

/**
 * Type-ahead attendee selector: filters a directory as the user types, shows
 * matches in a dropdown (keyboard navigable), and renders picks as removable
 * chips. Optionally offers to create a new entry when nothing matches.
 */
export function AttendeePicker({
  selected,
  options,
  onAdd,
  onRemove,
  onCreate,
  createHint = "as new",
  placeholder = "Type a name…",
  disabled,
  disabledMessage,
}: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurTimer = useRef<number | undefined>(undefined);

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected]);
  const trimmed = q.trim();
  const matches = useMemo(() => {
    const t = trimmed.toLowerCase();
    if (!t) return [];
    return options
      .filter((o) => !selectedIds.has(o.id) && o.name.toLowerCase().includes(t))
      .slice(0, 8);
  }, [trimmed, options, selectedIds]);

  const exact = options.some((o) => o.name.toLowerCase() === trimmed.toLowerCase());
  const showCreate = !!onCreate && trimmed.length > 0 && !exact;
  const rowCount = matches.length + (showCreate ? 1 : 0);

  function choose(idx: number) {
    if (idx < matches.length) onAdd(matches[idx]);
    else if (showCreate) onCreate!(trimmed);
    setQ("");
    setActive(0);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, rowCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (rowCount) {
        e.preventDefault();
        choose(active);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div>
      {selected.length > 0 && (
        <div className="token-group">
          {selected.map((s) => (
            <span className="token" key={s.id}>
              {s.name}
              {s.isNew && <span className="token-new">new</span>}
              <button
                type="button"
                className="token-x"
                onClick={() => onRemove(s.id)}
                aria-label={`Remove ${s.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {disabled ? (
        <div className="picker-disabled">{disabledMessage}</div>
      ) : (
        <div className="ac">
          <input
            className="form-input"
            placeholder={placeholder}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
              setActive(0);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              blurTimer.current = window.setTimeout(() => setOpen(false), 120);
            }}
            onKeyDown={onKeyDown}
          />
          {open && rowCount > 0 && (
            <div
              className="ac-menu"
              onMouseDown={(e) => {
                e.preventDefault();
                window.clearTimeout(blurTimer.current);
              }}
            >
              {matches.map((m, i) => (
                <div
                  key={m.id}
                  className={"ac-item" + (i === active ? " active" : "")}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(i)}
                >
                  <span className="nm">{m.name}</span>
                  {m.hint && <span className="ac-hint">{m.hint}</span>}
                </div>
              ))}
              {showCreate && (
                <div
                  className={"ac-item ac-create" + (active === matches.length ? " active" : "")}
                  onMouseEnter={() => setActive(matches.length)}
                  onClick={() => choose(matches.length)}
                >
                  ＋ Add “<b>{trimmed}</b>” {createHint}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
