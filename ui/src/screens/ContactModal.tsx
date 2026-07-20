import { useState } from "react";
import { CRM } from "../api/client";
import { Icon } from "../app/icons";
import { Modal } from "../app/Modal";
import { useToast } from "../app/toast";
import { useCrm } from "../crm/CrmContext";
import { monoGradient, personInitials } from "../crm/helpers";

const ROLE_SUGGESTIONS = ["Production", "Engineering", "Design", "Product", "Live Ops"];

interface Props {
  editingId: string | null;
  presetTeamId?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function ContactModal({ editingId, presetTeamId, onClose, onSaved }: Props) {
  const crm = useCrm();
  const { showToast } = useToast();
  const editing = editingId ? crm.contactById(editingId) : null;

  const [name, setName] = useState(editing?.name || "");
  const [role, setRole] = useState(editing?.role || "");
  const [team, setTeam] = useState(editing?.customerId || presetTeamId || "");
  const [email, setEmail] = useState(editing?.email || "");
  const [slack, setSlack] = useState((editing?.slack || "").replace(/^@/, ""));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const trimmedName = name.trim();
  const teamName = team ? crm.customerById(team)?.name : "";

  async function save() {
    if (!trimmedName) {
      setError("Name is required");
      return;
    }
    setBusy(true);
    try {
      const data = {
        name: trimmedName,
        role: role.trim(),
        email: email.trim(),
        slack: slack.trim() ? "@" + slack.trim().replace(/^@/, "") : "",
        customerId: team,
      };
      if (editingId) {
        await CRM.contacts.update(editingId, data);
        showToast("Contact updated", "green");
      } else {
        await CRM.contacts.create(data);
        showToast("Contact added", "green");
      }
      await Promise.all([
        crm.reloadContacts(),
        crm.reloadCustomers(),
        crm.reloadStats(),
        crm.reloadAudit(),
      ]);
      onSaved();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Save failed", "red");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={editing ? "Edit Contact" : "Add Contact"}
      subtitle={editing ? editing.name : "New point of contact"}
      size="sm"
      badge={
        editing ? (
          <div className="mono-badge" style={{ background: monoGradient(editing.name) }}>
            {personInitials(editing.name)}
          </div>
        ) : undefined
      }
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            <Icon name="check" />
            Save
          </button>
        </>
      }
    >
      <div className="contact-preview">
        <div
          className="mono-badge"
          style={{ background: trimmedName ? monoGradient(trimmedName) : "var(--line-strong)" }}
        >
          {trimmedName ? personInitials(trimmedName) : "?"}
        </div>
        <div>
          <div className="pv-name">{trimmedName || "New contact"}</div>
          <div className="pv-role">
            {role || "Role not set"}
            {teamName ? ` · ${teamName}` : ""}
          </div>
        </div>
      </div>

      <div className="form-grid">
        <div className={`field${error ? " invalid" : ""}`}>
          <label>
            Name <span className="req">*</span>
          </label>
          <input
            className="input"
            value={name}
            autoFocus
            placeholder="Full name"
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
          />
          {error && <div className="field-error">{error}</div>}
        </div>
        <div className="field">
          <label>Role</label>
          <input
            className="input"
            value={role}
            placeholder="e.g. Lead Engineer"
            onChange={(e) => setRole(e.target.value)}
          />
          <div className="quick-chips">
            {ROLE_SUGGESTIONS.map((r) => (
              <button key={r} type="button" className="quick-chip" onClick={() => setRole(r)}>
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="field" style={{ marginTop: 16 }}>
        <label>Customer</label>
        <select className="input" value={team} onChange={(e) => setTeam(e.target.value)}>
          <option value="">— No customer —</option>
          {crm.customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-grid" style={{ marginTop: 16 }}>
        <div className="field">
          <label>Email</label>
          <div className="input-group">
            <span className="adorn">
              <Icon name="email" />
            </span>
            <input
              value={email}
              placeholder="name@acme.example.com"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="hint">Optional — add it later if you don't have it yet.</div>
        </div>
        <div className="field">
          <label>Slack Handle</label>
          <div className="input-group">
            <span className="adorn">@</span>
            <input
              className="mono"
              value={slack}
              placeholder="handle"
              onChange={(e) => setSlack(e.target.value)}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
