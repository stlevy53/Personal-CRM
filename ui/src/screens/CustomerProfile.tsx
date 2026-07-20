import { useEffect, useState } from "react";
import { CRM } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Icon } from "../app/icons";
import { useNav } from "../app/nav";
import { useToast } from "../app/toast";
import {
  ActionStatusMenu,
  AppStatusBadge,
  EmptyState,
  InteractionBadge,
  InteractionNotes,
  SentimentBadge,
} from "../app/ui";
import { useCrm } from "../crm/CrmContext";
import {
  customerMono,
  formatDate,
  monoGradient,
  personInitials,
} from "../crm/helpers";
import { ContactModal } from "./ContactModal";
import { CustomerModal } from "./CustomerModal";

type Tab = "interactions" | "contacts" | "notes";

export function CustomerProfile() {
  const crm = useCrm();
  const { user } = useAuth();
  const { params, navigate } = useNav();
  const { showToast } = useToast();
  const teamId = params.currentTeamId || "";
  const team = crm.customerById(teamId);

  const [tab, setTab] = useState<Tab>("interactions");
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [contactModal, setContactModal] = useState<{ id: string | null } | null>(null);
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    if (!crm.loading && !team) navigate("s06");
  }, [crm.loading, team, navigate]);

  if (!team) return null;

  const interactions = crm.interactionsByTeam(team.id);
  const teamContacts = crm.contactsByTeam(team.id);
  const h = crm.hierarchy(team);
  const lastDate = interactions[0]?.date || null;
  const openCommitments = interactions.reduce(
    (n, i) => n + i.actionItems.filter((a) => a.status !== "closed").length,
    0
  );

  async function setActionStatus(interactionId: string, index: number, status: string) {
    await CRM.interactions.setActionStatus(interactionId, index, status);
    await Promise.all([crm.reloadInteractions(), crm.reloadAudit()]);
    showToast(`Commitment marked ${status === "in-progress" ? "In Progress" : status}`, "green");
  }

  async function postNote() {
    if (!noteText.trim()) return showToast("Note cannot be empty", "amber");
    await CRM.customers.addNote(team!.id, noteText.trim(), user?.email || user?.sub || "unknown");
    await Promise.all([crm.reloadCustomers(), crm.reloadAudit()]);
    setNoteText("");
    showToast("Team note posted", "green");
  }

  return (
    <section>
      <button className="back-link" onClick={() => navigate("s06")}>
        <Icon name="back" />
        All Customers
      </button>

      <div className="page-head" style={{ marginBottom: 20 }}>
        <h1 className="page-title">{team.name}</h1>
        <div className="row">
          <button className="btn btn-secondary" onClick={() => setEditingCustomer(true)}>
            Edit Customer
          </button>
          <button
            className="btn btn-primary"
            onClick={() => navigate("log", { editingInteractionId: null, currentTeamId: team.id })}
          >
            <Icon name="plus" />
            Log Interaction
          </button>
        </div>
      </div>

      <div className="card profile-hero">
        <div className="top">
          <div className="mono-badge" style={{ background: monoGradient(team.name) }}>
            {customerMono(team.name)}
          </div>
          <div style={{ flex: 1 }}>
            <div className="row-between">
              <div>
                <div className="name">{team.name}</div>
                <div className="crumb">
                  <b>{h.subdivision}</b> <span style={{ color: "var(--ink-4)" }}>→</span>{" "}
                  <b>{h.studio}</b>
                </div>
              </div>
              <AppStatusBadge status={team.appStatus} />
            </div>
          </div>
        </div>
        <div className="hero-divider" />
        <div className="meta-grid">
          <div>
            <div className="meta-label">Subdivision</div>
            <div className="meta-value">{h.subdivision}</div>
          </div>
          <div>
            <div className="meta-label">Studio</div>
            <div className="meta-value">{h.studio}</div>
          </div>
          <div>
            <div className="meta-label">Primary Slack</div>
            <div className="meta-value mono">{team.slackChannel || "—"}</div>
          </div>
          <div>
            <div className="meta-label">Interactions</div>
            <div className="meta-value">
              {interactions.length}
              <div className="sub">Last: {formatDate(lastDate)}</div>
            </div>
          </div>
          <div>
            <div className="meta-label">Open commitments</div>
            <div className="meta-value">{openCommitments}</div>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab${tab === "interactions" ? " active" : ""}`}
          onClick={() => setTab("interactions")}
        >
          Interactions<span className="count">{interactions.length}</span>
        </button>
        <button
          className={`tab${tab === "contacts" ? " active" : ""}`}
          onClick={() => setTab("contacts")}
        >
          Contacts<span className="count">{teamContacts.length}</span>
        </button>
        <button className={`tab${tab === "notes" ? " active" : ""}`} onClick={() => setTab("notes")}>
          Team Notes<span className="count">{team.notes.length}</span>
        </button>
      </div>

      {tab === "interactions" &&
        (interactions.length === 0 ? (
          <EmptyState
            message="No interactions logged for this customer yet."
            ctaLabel="Log an interaction"
            onCta={() => navigate("log", { editingInteractionId: null, currentTeamId: team.id })}
          />
        ) : (
          interactions.map((i) => {
            const internal = i.attendeesInternal.map(crm.engineerName).join(", ");
            const ext = i.attendeesExternal
              .map((id) => crm.contactById(id)?.name || "")
              .filter(Boolean)
              .join(", ");
            return (
              <div className="card ix" key={i.id}>
                <div className="ix-head">
                  <div className="ix-title">{i.title}</div>
                  <div className="row">
                    <span className="ix-date">{formatDate(i.date)}</span>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        navigate("log", { editingInteractionId: i.id, currentTeamId: team.id })
                      }
                    >
                      Edit
                    </button>
                  </div>
                </div>
                <div className="ix-meta">
                  <InteractionBadge type={i.type} />
                  <span className="sep">·</span>
                  <SentimentBadge sentiment={i.sentiment} />
                  <span className="sep">·</span>
                  <span>Internal: {internal || "—"}</span>
                  {ext && (
                    <>
                      <span className="sep">·</span>
                      <span>Contacts: {ext}</span>
                    </>
                  )}
                </div>
                <InteractionNotes text={i.notes} />
                {i.actionItems.length > 0 && (
                  <table className="commit-table">
                    <thead>
                      <tr>
                        <th>Commitment</th>
                        <th>Owner</th>
                        <th>Due</th>
                        <th style={{ width: 150 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {i.actionItems.map((a, idx) => (
                        <tr key={idx}>
                          <td className={a.status === "closed" ? "done" : ""}>{a.text}</td>
                          <td style={{ color: "var(--ink-2)" }}>
                            {a.ownerId ? crm.engineerName(a.ownerId) : "Unassigned"}
                          </td>
                          <td style={{ color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>
                            {a.dueDate ? formatDate(a.dueDate) : "—"}
                          </td>
                          <td>
                            <ActionStatusMenu
                              value={a.status}
                              onChange={(s) => setActionStatus(i.id, idx, s)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {i.tags.length > 0 && (
                  <div className="chip-row" style={{ marginTop: 14 }}>
                    {i.tags.map((t) => (
                      <span className="tag mono" key={t}>
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ))}

      {tab === "contacts" && (
        <>
          <div className="row-between" style={{ marginBottom: 14 }}>
            <div className="text-sm text-secondary">Contacts on file for this customer</div>
            <button className="btn btn-secondary btn-sm" onClick={() => setContactModal({ id: null })}>
              <Icon name="plus" />
              Add Contact
            </button>
          </div>
          {teamContacts.length === 0 ? (
            <EmptyState message="No contacts on file for this customer yet." />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Email</th>
                    <th>Slack</th>
                    <th style={{ textAlign: "right" }}>Interactions</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {teamContacts.map((ct) => {
                    const count = interactions.filter((i) =>
                      i.attendeesExternal.includes(ct.id)
                    ).length;
                    return (
                      <tr key={ct.id}>
                        <td>
                          <div className="cell-person">
                            <div
                              className="mini-avatar"
                              style={{ background: monoGradient(ct.name) }}
                            >
                              {personInitials(ct.name)}
                            </div>
                            <span className="name">{ct.name}</span>
                          </div>
                        </td>
                        <td>{ct.role || <span className="muted-cell">—</span>}</td>
                        <td>
                          {ct.email ? (
                            <span style={{ color: "var(--ink-2)" }}>{ct.email}</span>
                          ) : (
                            <span className="muted-cell">— not set</span>
                          )}
                        </td>
                        <td>
                          {ct.slack ? (
                            <span className="mono">{ct.slack}</span>
                          ) : (
                            <span className="muted-cell">—</span>
                          )}
                        </td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {count}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            className="row-action"
                            onClick={() => setContactModal({ id: ct.id })}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "notes" && (
        <div className="card card-pad">
          <textarea
            className="textarea"
            placeholder="Add a team-level relationship note (visible to everyone)…"
            style={{ minHeight: 90, marginBottom: 12 }}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <button className="btn btn-secondary" onClick={postNote}>
            Post Note
          </button>
          {team.notes.length > 0 && (
            <div style={{ marginTop: 20 }}>
              {[...team.notes]
                .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
                .map((n) => (
                <div className="note" key={n.id}>
                  <div className="note-meta">
                    <div
                      className="mini-avatar"
                      style={{
                        width: 22,
                        height: 22,
                        fontSize: 9,
                        background: monoGradient(crm.engineerName(n.authorId)),
                      }}
                    >
                      {personInitials(crm.engineerName(n.authorId))}
                    </div>
                    {crm.engineerName(n.authorId)} · {formatDate(n.createdAt)}
                  </div>
                  <div className="note-text">{n.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editingCustomer && (
        <CustomerModal
          editingId={team.id}
          onClose={() => setEditingCustomer(false)}
          onSaved={() => setEditingCustomer(false)}
        />
      )}
      {contactModal && (
        <ContactModal
          editingId={contactModal.id}
          presetTeamId={team.id}
          onClose={() => setContactModal(null)}
          onSaved={() => setContactModal(null)}
        />
      )}
    </section>
  );
}
