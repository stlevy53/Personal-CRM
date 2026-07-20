import { useEffect, useRef, useState } from "react";
import { CRM } from "../api/client";
import { Icon } from "../app/icons";
import { Modal } from "../app/Modal";
import { useToast } from "../app/toast";
import { useCrm } from "../crm/CrmContext";
import { customerMono, monoGradient } from "../crm/helpers";

const NEW = "__new__";

interface Props {
  editingId: string | null;
  onClose: () => void;
  onSaved: (customerId: string, isNew: boolean) => void;
}

function AppStatusPicker({
  value,
  onChange,
  onAddNew,
}: {
  value: string;
  onChange: (key: string) => void;
  onAddNew: () => void;
}) {
  const crm = useCrm();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const label = crm.appStatusMeta(value).label;

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
      <button type="button" className="st-trigger" onClick={() => setOpen((o) => !o)}>
        <span className="status" data-s={value} style={{ fontWeight: 600 }}>
          <span className="dot" />
          {label}
        </span>
        <Icon name="chevron" className="chev" />
      </button>
      {open && (
        <div className="st-menu">
          {crm.appStatuses.map((a) => (
            <div
              key={a.key}
              className="st-opt"
              onClick={() => {
                onChange(a.key);
                setOpen(false);
              }}
            >
              <span className="status" data-s={a.key} style={{ fontWeight: 600 }}>
                <span className="dot" />
                {a.label}
              </span>
            </div>
          ))}
          <div
            className="st-opt"
            style={{
              color: "var(--accent-press)",
              borderTop: "1px solid var(--line)",
              marginTop: 4,
              paddingTop: 10,
            }}
            onClick={() => {
              setOpen(false);
              onAddNew();
            }}
          >
            ＋ Add new status…
          </div>
        </div>
      )}
    </div>
  );
}

export function CustomerModal({ editingId, onClose, onSaved }: Props) {
  const crm = useCrm();
  const { showToast } = useToast();
  const editing = editingId ? crm.customerById(editingId) : null;

  const initialSub = editing
    ? crm.studioSubdivisionId(editing.studioId) || crm.subdivisions[0]?.id || ""
    : crm.subdivisions[0]?.id || "";

  const [name, setName] = useState(editing?.name || "");
  const [slack, setSlack] = useState((editing?.slackChannel || "").replace(/^#/, ""));
  const [subId, setSubId] = useState<string>(initialSub);
  const [studioId, setStudioId] = useState<string>(editing?.studioId || "");
  const [statusKey, setStatusKey] = useState<string>(editing?.appStatus || "pre-production");

  const [newSub, setNewSub] = useState("");
  const [newStudio, setNewStudio] = useState("");
  const [addingStatus, setAddingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [errors, setErrors] = useState<{ name?: string; studio?: string }>({});
  const [busy, setBusy] = useState(false);

  const studiosInSub = crm.studios.filter((s) => s.subdivisionId === subId);
  const subName = subId === NEW ? "" : crm.subdivisions.find((s) => s.id === subId)?.name || "";
  const studioName =
    studioId === NEW ? "" : crm.studios.find((s) => s.id === studioId)?.name || "";

  async function addSubdivision() {
    const n = newSub.trim();
    if (!n) return showToast("Subdivision name required", "amber");
    const sub = await CRM.subdivisions.create(n);
    await crm.reloadOrg();
    setSubId(sub.id);
    setStudioId(NEW);
    setNewSub("");
    showToast(`Added subdivision "${sub.name}"`, "green");
  }

  async function addStudio() {
    if (!subId || subId === NEW) return showToast("Pick or add a subdivision first", "amber");
    const n = newStudio.trim();
    if (!n) return showToast("Studio name required", "amber");
    const studio = await CRM.studios.create(n, subId);
    await crm.reloadOrg();
    setStudioId(studio.id);
    setNewStudio("");
    setErrors((e) => ({ ...e, studio: undefined }));
    showToast(`Added studio "${studio.name}"`, "green");
  }

  async function addStatus() {
    const n = newStatus.trim();
    if (!n) return showToast("Status name required", "amber");
    const st = await CRM.appStatuses.create(n);
    await crm.reloadOrg();
    setStatusKey(st.key);
    setNewStatus("");
    setAddingStatus(false);
    showToast(`Added app status "${st.label}"`, "green");
  }

  async function save() {
    const e: { name?: string; studio?: string } = {};
    if (!name.trim()) e.name = "Name is required";
    if (!studioId || studioId === NEW) e.studio = "Select or add a studio";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const data = {
        name: name.trim(),
        studioId,
        appStatus: statusKey,
        slackChannel: slack.trim() ? "#" + slack.trim().replace(/^#/, "") : "",
      };
      if (editingId) {
        await CRM.customers.update(editingId, data);
        await Promise.all([crm.reloadCustomers(), crm.reloadAudit()]);
        showToast("Customer updated", "green");
        onSaved(editingId, false);
      } else {
        const created = await CRM.customers.create(data);
        await Promise.all([crm.reloadCustomers(), crm.reloadStats(), crm.reloadAudit()]);
        showToast(`Created profile for ${created.name}`, "green");
        onSaved(created.id, true);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Save failed", "red");
    } finally {
      setBusy(false);
    }
  }

  const hierPart = (v: string, ph: string) => (
    <span className={`h${v ? "" : " muted"}`}>{v || ph}</span>
  );

  return (
    <Modal
      title={editing ? "Edit Customer" : "Add Customer"}
      subtitle={editing ? editing.name : "Create a new customer profile"}
      badge={
        editing ? (
          <div className="mono-badge" style={{ background: monoGradient(editing.name) }}>
            {customerMono(editing.name)}
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
      <div className={`field${errors.name ? " invalid" : ""}`}>
        <label>
          Name <span className="req">*</span>
        </label>
        <input
          className="input"
          value={name}
          autoFocus
          placeholder="Customer / game name"
          onChange={(e) => setName(e.target.value)}
        />
        {errors.name && <div className="field-error">{errors.name}</div>}
      </div>

      <div className="field-section" style={{ marginTop: 22 }}>
        Organization
      </div>
      <div className="form-grid">
        <div className="field">
          <label>Subdivision</label>
          <select
            className="input"
            value={subId}
            onChange={(e) => {
              const v = e.target.value;
              setSubId(v);
              if (v !== NEW) setStudioId("");
            }}
          >
            {crm.subdivisions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value={NEW}>＋ Add new subdivision…</option>
          </select>
          {subId === NEW && (
            <div className="inline-create">
              <input
                className="input"
                placeholder="New subdivision name"
                autoFocus
                value={newSub}
                onChange={(e) => setNewSub(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSubdivision())}
              />
              <button className="btn btn-primary" type="button" onClick={addSubdivision}>
                Add
              </button>
            </div>
          )}
        </div>
        <div className={`field${errors.studio ? " invalid" : ""}`}>
          <label>Studio</label>
          <select
            className="input"
            value={studioId}
            onChange={(e) => {
              setStudioId(e.target.value);
              setErrors((prev) => ({ ...prev, studio: undefined }));
            }}
            disabled={subId === NEW}
          >
            <option value="">Select a studio…</option>
            {studiosInSub.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value={NEW}>＋ Add new studio…</option>
          </select>
          {studioId === NEW && (
            <div className="inline-create">
              <input
                className="input"
                placeholder="New studio name"
                autoFocus
                value={newStudio}
                onChange={(e) => setNewStudio(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addStudio())}
              />
              <button className="btn btn-primary" type="button" onClick={addStudio}>
                Add
              </button>
            </div>
          )}
          {errors.studio && <div className="field-error">{errors.studio}</div>}
        </div>
      </div>

      <div className="hier-preview">
        <span className="lbl">Hierarchy</span>
        <span className="h">Acme Games</span>
        <Icon name="chevron" />
        {hierPart(subName, "Subdivision")}
        <Icon name="chevron" />
        {hierPart(studioName, "Studio")}
        <Icon name="chevron" />
        {hierPart(name.trim(), "Customer")}
      </div>

      <div className="field" style={{ marginTop: 18 }}>
        <label>App Status</label>
        <AppStatusPicker
          value={statusKey}
          onChange={setStatusKey}
          onAddNew={() => setAddingStatus(true)}
        />
        {addingStatus && (
          <div className="inline-create">
            <input
              className="input"
              placeholder="New app status name"
              autoFocus
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addStatus())}
            />
            <button className="btn btn-primary" type="button" onClick={addStatus}>
              Add
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setAddingStatus(false)}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="field" style={{ marginTop: 18 }}>
        <label>Primary Slack Channel</label>
        <div className="input-group">
          <span className="adorn">#</span>
          <input
            className="mono"
            value={slack}
            placeholder="channel-name"
            onChange={(e) => setSlack(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
