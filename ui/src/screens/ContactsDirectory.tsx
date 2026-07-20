import { useRef, useState } from "react";
import { CRM } from "../api/client";
import { Icon } from "../app/icons";
import { useNav } from "../app/nav";
import { useToast } from "../app/toast";
import { useCrm } from "../crm/CrmContext";
import { monoGradient, personInitials } from "../crm/helpers";
import { ContactModal } from "./ContactModal";

const COLS = [
  { key: "name", label: "Name" },
  { key: "role", label: "Role" },
  { key: "team", label: "Customer" },
  { key: "email", label: "Email" },
  { key: "slack", label: "Slack" },
] as const;

type SortKey = (typeof COLS)[number]["key"];

interface ContactRow {
  c: import("../api/types").Contact;
  team: string;
}

// Minimal RFC-4180-ish CSV parser (quoted fields, escaped quotes, CRLF).
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch === "\r") {
      /* ignore */
    } else field += ch;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function ContactsDirectory() {
  const crm = useCrm();
  const { navigate } = useNav();
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [modal, setModal] = useState<{ id: string | null } | null>(null);

  const teamName = (id: string) => crm.customerById(id)?.name || "";

  const roles = [...new Set(crm.contacts.map((c) => c.role).filter(Boolean))].sort();

  let rows: ContactRow[] = crm.contacts.map((c) => ({ c, team: teamName(c.gameTeamId) }));
  if (teamFilter) rows = rows.filter((r) => r.c.gameTeamId === teamFilter);
  if (roleFilter) rows = rows.filter((r) => r.c.role === roleFilter);
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter((r) =>
      [r.c.name, r.c.role, r.team, r.c.email, r.c.slack].some((x) =>
        (x || "").toLowerCase().includes(q)
      )
    );
  }
  const cellVal = (r: ContactRow, k: SortKey) =>
    (k === "team" ? r.team : (r.c[k] as string) || "").toLowerCase();
  rows = [...rows].sort((a, b) => {
    const av = cellVal(a, sortKey);
    const bv = cellVal(b, sortKey);
    return (av < bv ? -1 : av > bv ? 1 : 0) * (sortDir === "asc" ? 1 : -1);
  });

  function sort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function downloadTemplate() {
    const csv =
      "Name,Role,Customer,Email,Slack Handle\n" +
      "Jane Doe,Lead Engineer,Frontier Quest 3,j.doe@acme.example.com,@j_doe\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts_template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function importCSV(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    input.value = "";
    try {
      const parsed = parseCSV(text).filter((r) => r.some((c) => c.trim() !== ""));
      if (!parsed.length) return showToast("CSV is empty", "amber");
      const header = parsed[0].map((h) => h.trim().toLowerCase());
      const col = (n: string) => header.indexOf(n);
      const ni = col("name");
      const ri = col("role");
      const ei = col("email");
      const si = col("slack handle");
      const ti = [col("customer"), col("game"), col("game team")].find((x) => x !== -1) ?? -1;
      if (ni === -1) return showToast('CSV must include a "Name" column', "red");

      let added = 0;
      for (const r of parsed.slice(1)) {
        const name = (r[ni] || "").trim();
        if (!name) continue;
        let teamId = "";
        const teamVal = ti !== -1 ? (r[ti] || "").trim() : "";
        if (teamVal) {
          const existing =
            crm.customers.find((t) => t.name.toLowerCase() === teamVal.toLowerCase()) ||
            crm.customers.find((t) => t.id === teamVal);
          teamId = existing ? existing.id : (await CRM.customers.create({ name: teamVal })).id;
        }
        await CRM.contacts.create({
          name,
          role: ri !== -1 ? (r[ri] || "").trim() : "",
          email: ei !== -1 ? (r[ei] || "").trim() : "",
          slack: si !== -1 ? (r[si] || "").trim() : "",
          gameTeamId: teamId,
        });
        added++;
      }
      await Promise.all([
        crm.reloadContacts(),
        crm.reloadCustomers(),
        crm.reloadStats(),
        crm.reloadAudit(),
      ]);
      showToast(`Imported ${added} contact${added !== 1 ? "s" : ""}`, added ? "green" : "amber");
    } catch (e) {
      showToast("Could not parse CSV: " + (e instanceof Error ? e.message : "unknown error"), "red");
    }
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <div className="eyebrow">Relationships</div>
          <h1 className="page-title">Contacts</h1>
          <div className="page-sub">External points of contact across every customer team.</div>
        </div>
        <div className="row">
          <button className="btn btn-ghost btn-sm" onClick={downloadTemplate}>
            <Icon name="download" />
            CSV Template
          </button>
          <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
            <Icon name="download" />
            Import CSV
          </button>
          <button className="btn btn-primary" onClick={() => setModal({ id: null })}>
            <Icon name="plus" />
            Add Contact
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={(e) => importCSV(e.target)}
          />
        </div>
      </div>

      <div className="filterbar">
        <div className="search">
          <Icon name="search" />
          <input
            placeholder="Search contacts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="select" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
          <option value="">All Customers</option>
          {crm.customers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select className="select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All Roles</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <span className="result-count">
          {rows.length} contact{rows.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              {COLS.map((c) => (
                <th key={c.key} className="sortable" onClick={() => sort(c.key)}>
                  {c.label}
                  {sortKey === c.key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--ink-3)" }}>
                  No contacts match the current filters.
                </td>
              </tr>
            ) : (
              rows.map(({ c, team }) => (
                <tr key={c.id}>
                  <td>
                    <div className="cell-person">
                      <div className="mini-avatar" style={{ background: monoGradient(c.name) }}>
                        {personInitials(c.name)}
                      </div>
                      <span className="name">{c.name}</span>
                    </div>
                  </td>
                  <td>{c.role || <span className="muted-cell">—</span>}</td>
                  <td>
                    {c.gameTeamId ? (
                      <button
                        className="link"
                        onClick={() => navigate("s05", { currentTeamId: c.gameTeamId })}
                      >
                        {team}
                      </button>
                    ) : (
                      <span className="muted-cell">—</span>
                    )}
                  </td>
                  <td>
                    {c.email ? (
                      <span style={{ color: "var(--ink-2)" }}>{c.email}</span>
                    ) : (
                      <span className="muted-cell">— not set</span>
                    )}
                  </td>
                  <td>
                    {c.slack ? (
                      <span className="mono">{c.slack}</span>
                    ) : (
                      <span className="muted-cell">—</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="row-action" onClick={() => setModal({ id: c.id })}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <ContactModal
          editingId={modal.id}
          onClose={() => setModal(null)}
          onSaved={() => setModal(null)}
        />
      )}
    </section>
  );
}
