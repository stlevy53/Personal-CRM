import { useState } from "react";
import type { AuditEntry } from "../api/types";
import { Icon } from "../app/icons";
import { useNav } from "../app/nav";
import { useToast } from "../app/toast";
import { useCrm } from "../crm/CrmContext";
import { formatAuditTime, monoGradient, personInitials } from "../crm/helpers";

// Map a free-text action to a coloured dot category.
function actionKind(action: string): string {
  const a = action.toLowerCase();
  if (a.includes("delete") || a.includes("removed")) return "deleted";
  if (a.includes("import")) return "imported";
  if (a.includes("note")) return "note";
  if (a.includes("updated") || a.includes("changed")) return "updated";
  if (a.includes("created") || a.includes("added") || a.includes("logged")) return "created";
  return "updated";
}

const ACTION_FILTERS = ["created", "updated", "closed", "note", "imported", "deleted"];

export function AuditLog() {
  const crm = useCrm();
  const { navigate } = useNav();
  const { showToast } = useToast();

  const [search, setSearch] = useState("");
  const [actFilter, setActFilter] = useState("");

  function actor(id: string): { name: string; type: string; system: boolean } {
    if (id === "system" || !id) return { name: "System", type: "System", system: true };
    if (id === "admin") return { name: "Admin", type: "Internal", system: false };
    const person = crm.people.find((p) => p.id === id);
    if (person) return { name: person.name, type: "Internal", system: false };
    const ct = crm.contactById(id);
    if (ct) return { name: ct.name, type: "Customer", system: false };
    return { name: id, type: "Internal", system: false };
  }

  // Resolve the customer this audit row relates to, for click-through.
  function targetTeam(e: AuditEntry): string | null {
    if (e.recordType === "Interaction") {
      const ix = crm.interactions.find((i) => i.id === e.recordId);
      return ix?.customerId || null;
    }
    if (e.recordType === "Profile") {
      return crm.customerById(e.recordId) ? e.recordId : null;
    }
    if (e.recordType === "Contact") {
      const c = crm.contactById(e.recordId);
      return c?.customerId || null;
    }
    return null;
  }

  let rows = crm.audit;
  if (actFilter) rows = rows.filter((e) => actionKind(e.action) === actFilter);
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter((e) =>
      [actor(e.actorId).name, e.action, e.recordType, e.recordId, e.detail].some((x) =>
        (x || "").toLowerCase().includes(q)
      )
    );
  }

  function exportCsv() {
    const header = "Timestamp,Actor,Action,Record Type,Record ID,Details\n";
    const esc = (s: string) => `"${(s || "").replace(/"/g, '""')}"`;
    const body = rows
      .map((e) =>
        [
          formatAuditTime(e.timestamp),
          actor(e.actorId).name,
          e.action,
          e.recordType,
          e.recordId,
          e.detail,
        ]
          .map(esc)
          .join(",")
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audit_log.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(`Exported ${rows.length} events`, "green");
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <div className="eyebrow">Admin</div>
          <h1 className="page-title">Audit Log</h1>
          <div className="page-sub">Every change across the workspace, with actor and detail.</div>
        </div>
        <button className="btn btn-secondary" onClick={exportCsv}>
          <Icon name="download" />
          Export CSV
        </button>
      </div>

      <div className="filterbar">
        <div className="search">
          <Icon name="search" />
          <input
            placeholder="Search the audit trail…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="select" value={actFilter} onChange={(e) => setActFilter(e.target.value)}>
          <option value="">All actions</option>
          {ACTION_FILTERS.map((a) => (
            <option key={a} value={a}>
              {a[0].toUpperCase() + a.slice(1)}
            </option>
          ))}
        </select>
        <span className="result-count">
          {rows.length} event{rows.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th style={{ width: 160 }}>Timestamp</th>
              <th>Actor</th>
              <th style={{ width: 140 }}>Action</th>
              <th>Record</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--ink-3)" }}>
                  No audit events match the current filters.
                </td>
              </tr>
            ) : (
              rows.map((e) => {
                const a = actor(e.actorId);
                const team = targetTeam(e);
                const kind = actionKind(e.action);
                return (
                  <tr
                    key={e.id}
                    className={team ? "clickable" : ""}
                    onClick={team ? () => navigate("s05", { currentTeamId: team }) : undefined}
                  >
                    <td
                      className="mono"
                      style={{ whiteSpace: "nowrap", color: "var(--ink-2)" }}
                    >
                      {formatAuditTime(e.timestamp)}
                    </td>
                    <td>
                      <div className="cell-person">
                        {a.system ? (
                          <div className="mini-avatar" style={{ background: "var(--ink-3)" }}>
                            <Icon name="settings" />
                          </div>
                        ) : (
                          <div className="mini-avatar" style={{ background: monoGradient(a.name) }}>
                            {personInitials(a.name)}
                          </div>
                        )}
                        <span>
                          <span className="name">{a.name}</span>
                          <span className="actor-type">{a.type}</span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="audit-act" data-a={kind}>
                        <span className="dot" />
                        {e.action}
                      </span>
                    </td>
                    <td>
                      <span className="rec-type">{e.recordType}</span>{" "}
                      <span className="rec-id">{e.recordId}</span>
                    </td>
                    <td style={{ color: "var(--ink-2)" }}>
                      <div className="audit-detail">
                        <span>{e.detail}</span>
                        {team && (
                          <span className="audit-go">
                            <Icon name="arrow" />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
