import { useState } from "react";
import { Icon } from "../app/icons";
import { useNav } from "../app/nav";
import { AppStatusBadge, EmptyState } from "../app/ui";
import { useCrm } from "../crm/CrmContext";
import { customerMono, monoGradient, relativeDate } from "../crm/helpers";
import { CustomerModal } from "./CustomerModal";

export function CustomersDirectory() {
  const crm = useCrm();
  const { navigate } = useNav();

  const [search, setSearch] = useState("");
  const [subdivision, setSubdivision] = useState("");
  const [studio, setStudio] = useState("");
  const [appStatus, setAppStatus] = useState("");
  const [adding, setAdding] = useState(false);

  const studioOptions = crm.studios.filter((s) => !subdivision || s.subdivisionId === subdivision);

  let list = crm.customers;
  if (subdivision) list = list.filter((t) => crm.studioSubdivisionId(t.studioId) === subdivision);
  if (studio) list = list.filter((t) => t.studioId === studio);
  if (appStatus) list = list.filter((t) => t.appStatus === appStatus);
  if (search) {
    const q = search.toLowerCase();
    list = list.filter((t) => t.name.toLowerCase().includes(q));
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <div className="eyebrow">Relationships</div>
          <h1 className="page-title">Customers</h1>
          <div className="page-sub">
            Every company and contact you're tracking.
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          <Icon name="plus" />
          Add Customer
        </button>
      </div>

      <div className="filterbar">
        <div className="search">
          <Icon name="search" />
          <input
            placeholder="Search customers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="select"
          value={subdivision}
          onChange={(e) => {
            setSubdivision(e.target.value);
            const s = crm.studios.find((x) => x.id === studio);
            if (s && e.target.value && s.subdivisionId !== e.target.value) setStudio("");
          }}
        >
          <option value="">All Subdivisions</option>
          {crm.subdivisions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select className="select" value={studio} onChange={(e) => setStudio(e.target.value)}>
          <option value="">All Studios</option>
          {studioOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select className="select" value={appStatus} onChange={(e) => setAppStatus(e.target.value)}>
          <option value="">All App Statuses</option>
          {crm.appStatuses.map((a) => (
            <option key={a.key} value={a.key}>
              {a.label}
            </option>
          ))}
        </select>
        <span className="result-count">
          {list.length} customer{list.length !== 1 ? "s" : ""}
        </span>
      </div>

      {list.length === 0 ? (
        <EmptyState
          message="No customers match the current filters."
          ctaLabel="Add a customer"
          onCta={() => setAdding(true)}
        />
      ) : (
        <div className="cust-grid">
          {list.map((t) => {
            const count = crm.interactionsByTeam(t.id).length;
            const last = crm.interactionsByTeam(t.id)[0]?.date || null;
            const h = crm.hierarchy(t);
            return (
              <div
                key={t.id}
                className="card cust-card card-int"
                onClick={() => navigate("s05", { currentTeamId: t.id })}
              >
                <div className="top">
                  <div className="mono-badge" style={{ background: monoGradient(t.name) }}>
                    {customerMono(t.name)}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="name">{t.name}</div>
                    <div className="path">
                      {h.subdivision} · {h.studio}
                    </div>
                    <div style={{ marginTop: 9 }}>
                      <AppStatusBadge status={t.appStatus} />
                    </div>
                  </div>
                </div>
                <div className="foot">
                  <span>
                    <b>{count}</b> interaction{count !== 1 ? "s" : ""}
                  </span>
                  <span>{last ? `Last ${relativeDate(last)}` : "No activity"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {adding && (
        <CustomerModal
          editingId={null}
          onClose={() => setAdding(false)}
          onSaved={(id) => {
            setAdding(false);
            navigate("s05", { currentTeamId: id });
          }}
        />
      )}
    </section>
  );
}
