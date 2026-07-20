import { useEffect, useState } from "react";
import { CRM } from "../api/client";
import { AttendeePicker } from "../app/AttendeePicker";
import { Icon, type IconName } from "../app/icons";
import { useNav } from "../app/nav";
import { useToast } from "../app/toast";
import { ActionStatusMenu } from "../app/ui";
import { useCrm } from "../crm/CrmContext";

const NEW = "__new__";

const TYPES: { key: string; label: string; icon: IconName }[] = [
  { key: "meeting", label: "Meeting", icon: "meeting" },
  { key: "call", label: "Call", icon: "call" },
  { key: "email", label: "Email", icon: "email" },
  { key: "slack", label: "Slack", icon: "slack" },
  { key: "other", label: "Other", icon: "other" },
];

const SENTIMENT_OPTS: { key: string; label: string; icon: IconName }[] = [
  { key: "positive", label: "Positive", icon: "positive" },
  { key: "neutral", label: "Neutral", icon: "neutral" },
  { key: "negative", label: "Negative", icon: "negative" },
];

interface ActionRow {
  text: string;
  ownerId: string;
  dueDate: string;
  status: string;
}

interface PendingContact {
  tempId: string;
  name: string;
  role: string;
  email: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export function LogInteraction() {
  const crm = useCrm();
  const { params, navigate } = useNav();
  const { showToast } = useToast();
  const editing = params.editingInteractionId
    ? crm.interactions.find((i) => i.id === params.editingInteractionId)
    : null;

  const [teamSel, setTeamSel] = useState<string>(editing?.gameTeamId || params.currentTeamId || "");
  const [type, setType] = useState(editing?.type || "meeting");
  const [sentiment, setSentiment] = useState<string>(editing?.sentiment || "neutral");
  const [date, setDate] = useState(editing ? new Date(editing.date).toISOString().slice(0, 10) : today());
  const [title, setTitle] = useState(editing?.title || "");
  const [notes, setNotes] = useState(editing?.notes || "");
  const [tags, setTags] = useState((editing?.tags || []).join(", "));

  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamStudio, setNewTeamStudio] = useState(crm.studios[0]?.id || "");
  const [newTeamStatus, setNewTeamStatus] = useState("prototype");

  const [actions, setActions] = useState<ActionRow[]>(
    editing && editing.actionItems.length
      ? editing.actionItems.map((a) => ({
          text: a.text,
          ownerId: a.ownerId || "",
          dueDate: a.dueDate || "",
          status: a.status,
        }))
      : [{ text: "", ownerId: "", dueDate: "", status: "open" }]
  );

  const [mgt, setMgt] = useState<Set<string>>(new Set(editing ? editing.attendeesMgt : []));
  const [checkedExternal, setCheckedExternal] = useState<Set<string>>(
    new Set(editing ? editing.attendeesExternal : [])
  );
  const [pending, setPending] = useState<PendingContact[]>([]);
  const [pendSeq, setPendSeq] = useState(0);

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (editing && teamSel === editing.gameTeamId) return;
    setCheckedExternal(new Set());
    setPending([]);
  }, [teamSel]); // eslint-disable-line react-hooks/exhaustive-deps

  const teamContacts = teamSel && teamSel !== NEW ? crm.contactsByTeam(teamSel) : [];

  function podName(podId: string | null | undefined) {
    if (!podId) return undefined;
    return crm.pods.find((p) => p.id === podId)?.name;
  }

  function addMgt(id: string) {
    setMgt((prev) => new Set(prev).add(id));
  }
  function removeMgt(id: string) {
    setMgt((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }
  function addExisting(id: string) {
    setCheckedExternal((prev) => new Set(prev).add(id));
  }
  function removeExternal(id: string) {
    if (id.startsWith("pending:")) {
      setPending((prev) => prev.filter((x) => x.tempId !== id));
      return;
    }
    setCheckedExternal((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function createMgtPerson(name: string) {
    const n = name.trim();
    if (!n) return;
    const p = await CRM.people.create(n);
    await crm.reloadPeople();
    addMgt(p.id);
    showToast(`${p.name} added to the MGT directory`, "green");
  }

  function addPendingContact(name: string) {
    const n = name.trim();
    if (!n) return;
    setPending((prev) => [...prev, { tempId: `pending:${pendSeq}`, name: n, role: "", email: "" }]);
    setPendSeq((s) => s + 1);
  }

  function updateAction(idx: number, patch: Partial<ActionRow>) {
    setActions((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  }

  async function submit() {
    if (!teamSel) return showToast("Please select a customer", "amber");
    setBusy(true);
    try {
      let teamId = teamSel;
      if (teamSel === NEW) {
        const n = newTeamName.trim();
        if (!n) {
          setBusy(false);
          return showToast("Enter a name for the new customer", "amber");
        }
        const created = await CRM.customers.create({
          name: n,
          studioId: newTeamStudio,
          appStatus: newTeamStatus,
        });
        teamId = created.id;
      }
      if (!title.trim()) {
        setBusy(false);
        return showToast("Please enter a title", "amber");
      }
      if (!notes.trim()) {
        setBusy(false);
        return showToast("Please enter notes", "amber");
      }

      const actionItems = actions
        .filter((a) => a.text.trim())
        .map((a) => ({
          text: a.text.trim(),
          ownerId: a.ownerId || null,
          dueDate: a.dueDate || null,
          status: a.status as "open" | "in-progress" | "closed",
        }));

      const attendeesExternal: string[] = [...checkedExternal];
      for (const p of pending) {
        const c = await CRM.contacts.create({
          name: p.name,
          role: p.role,
          email: p.email,
          gameTeamId: teamId,
        });
        attendeesExternal.push(c.id);
      }

      const tagList = tags.split(",").map((s) => s.trim()).filter(Boolean);
      const payload = {
        type,
        sentiment: sentiment as "positive" | "neutral" | "negative",
        title: title.trim(),
        date,
        notes: notes.trim(),
        actionItems,
        tags: tagList,
        attendeesMgt: [...mgt],
        attendeesExternal,
        gameTeamId: teamId,
      };

      if (editing) {
        const r = await CRM.interactions.update(editing.id, payload);
        showToast(`Interaction ${r.id} updated`, "green");
      } else {
        const r = await CRM.interactions.create({ ...payload, loggedBy: "" });
        showToast(`Interaction ${r.id} logged`, "green");
      }

      await Promise.all([
        crm.reloadInteractions(),
        crm.reloadContacts(),
        crm.reloadCustomers(),
        crm.reloadStats(),
        crm.reloadAudit(),
      ]);
      navigate("s05", { currentTeamId: teamId });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Save failed", "red");
    } finally {
      setBusy(false);
    }
  }

  const cancelTo = () =>
    editing ? navigate("s05", { currentTeamId: editing.gameTeamId }) : navigate("home");

  return (
    <section>
      <button className="back-link" onClick={cancelTo}>
        <Icon name="back" />
        {editing ? "Back to Customer" : "Back to Feed"}
      </button>

      <div className="page-head" style={{ marginBottom: 24 }}>
        <div>
          <div className="eyebrow">Workspace</div>
          <h1 className="page-title">{editing ? "Edit Interaction" : "Log Interaction"}</h1>
          <div className="page-sub">
            Capture a meeting, call, email, or Slack thread — with attendees and commitments.
          </div>
        </div>
      </div>

      <div className="card card-pad" style={{ maxWidth: 860 }}>
        <div className="field full" style={{ marginBottom: 20 }}>
          <label>Type</label>
          <div className="type-toggle">
            {TYPES.map((t) => (
              <div
                key={t.key}
                className={`type-opt${type === t.key ? " sel" : ""}`}
                onClick={() => setType(t.key)}
              >
                <Icon name={t.icon} />
                {t.label}
              </div>
            ))}
          </div>
        </div>

        <div className="field full" style={{ marginBottom: 20 }}>
          <label>Sentiment</label>
          <div className="type-toggle sentiment-toggle">
            {SENTIMENT_OPTS.map((o) => (
              <div
                key={o.key}
                className={`type-opt${sentiment === o.key ? ` sel sm-${o.key}` : ""}`}
                onClick={() => setSentiment(o.key)}
              >
                <Icon name={o.icon} />
                {o.label}
              </div>
            ))}
          </div>
          <div className="hint">How did this interaction feel for the relationship?</div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label>
              Customer <span className="req">*</span>
            </label>
            <select className="input" value={teamSel} onChange={(e) => setTeamSel(e.target.value)}>
              <option value="">Select a customer…</option>
              <option value={NEW}>＋ Create new customer…</option>
              {crm.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>
              Date <span className="req">*</span>
            </label>
            <input
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {teamSel === NEW && (
            <div className="field full">
              <div className="subform">
                <div className="subform-head">
                  New Customer <span className="tag">inline</span>
                </div>
                <div className="subform-grid">
                  <div className="field">
                    <label>
                      Customer Name <span className="req">*</span>
                    </label>
                    <input
                      className="input"
                      placeholder="e.g. Project Phoenix"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Studio</label>
                    <select
                      className="input"
                      value={newTeamStudio}
                      onChange={(e) => setNewTeamStudio(e.target.value)}
                    >
                      {crm.subdivisions.map((sub) => (
                        <optgroup key={sub.id} label={sub.name}>
                          {crm.studios
                            .filter((s) => s.subdivisionId === sub.id)
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>App Status</label>
                    <select
                      className="input"
                      value={newTeamStatus}
                      onChange={(e) => setNewTeamStatus(e.target.value)}
                    >
                      {crm.appStatuses.map((a) => (
                        <option key={a.key} value={a.key}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="field full">
            <label>
              Title / Topic <span className="req">*</span>
            </label>
            <input
              className="input"
              placeholder="e.g. Q2 infrastructure planning sync"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="field full">
            <label>
              Notes <span className="req">*</span>
            </label>
            <textarea
              className="textarea"
              placeholder="What was discussed? Decisions, context, concerns, anything worth remembering…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="hint">
              These notes feed the AI knowledge base — the more context, the better the search results.
            </div>
          </div>
        </div>

        <div className="form-grid" style={{ marginTop: 18 }}>
          <div className="field">
            <label>MGT Attendees</label>
            <AttendeePicker
              selected={[...mgt].map((id) => {
                const p = crm.people.find((x) => x.id === id);
                return { id, name: p ? p.name : id };
              })}
              options={crm.people.map((p) => ({ id: p.id, name: p.name, hint: podName(p.podId) }))}
              onAdd={(o) => addMgt(o.id)}
              onRemove={removeMgt}
              onCreate={createMgtPerson}
              createHint="as new MGT person"
              placeholder="Search MGT team by name…"
            />
          </div>
          <div className="field">
            <label>Customer Attendees</label>
            <AttendeePicker
              selected={[
                ...[...checkedExternal].map((id) => {
                  const c = crm.contactById(id);
                  return { id, name: c ? c.name : id };
                }),
                ...pending.map((p) => ({ id: p.tempId, name: p.name, isNew: true })),
              ]}
              options={teamContacts.map((c) => ({ id: c.id, name: c.name, hint: c.role || undefined }))}
              onAdd={(o) => addExisting(o.id)}
              onRemove={removeExternal}
              onCreate={addPendingContact}
              createHint="as new contact"
              placeholder={
                teamSel === NEW
                  ? "Add an attendee for the new customer…"
                  : "Search this customer's contacts…"
              }
              disabled={!teamSel}
              disabledMessage="Select a customer first to choose or add attendees."
            />
          </div>
        </div>

        <div className="field full" style={{ marginTop: 18 }}>
          <label>Tags</label>
          <input
            className="input"
            placeholder="Comma-separated, e.g. scaling, observability, q2-planning"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>

        <div className="hero-divider" />
        <div className="col-head">
          <span>Commitments / action items</span>
        </div>
        <table className="commit-table">
          <thead>
            <tr>
              <th style={{ width: "40%" }}>Item</th>
              <th>Owner</th>
              <th style={{ width: 150 }}>Due</th>
              <th style={{ width: 150 }}>Status</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {actions.map((a, idx) => (
              <tr key={idx}>
                <td>
                  <input
                    className="input"
                    placeholder="Action item…"
                    value={a.text}
                    onChange={(e) => updateAction(idx, { text: e.target.value })}
                  />
                </td>
                <td>
                  <select
                    className="input"
                    value={a.ownerId}
                    onChange={(e) => updateAction(idx, { ownerId: e.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {crm.people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="date"
                    className="input"
                    value={a.dueDate}
                    onChange={(e) => updateAction(idx, { dueDate: e.target.value })}
                  />
                </td>
                <td>
                  <ActionStatusMenu
                    value={a.status}
                    onChange={(s) => updateAction(idx, { status: s })}
                  />
                </td>
                <td>
                  <button
                    className="row-remove"
                    title="Remove"
                    onClick={() => setActions((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          className="btn btn-ghost btn-sm add-row"
          onClick={() =>
            setActions((prev) => [...prev, { text: "", ownerId: "", dueDate: "", status: "open" }])
          }
        >
          <Icon name="plus" />
          Add action item
        </button>

        <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 26 }}>
          <button className="btn btn-ghost" onClick={cancelTo}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            <Icon name="check" />
            {editing ? "Update Interaction" : "Save Interaction"}
          </button>
        </div>
      </div>
    </section>
  );
}
