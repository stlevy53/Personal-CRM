import { Icon, type IconName } from "../app/icons";
import { useNav } from "../app/nav";
import { EmptyState, InteractionBadge, InteractionNotes, SentimentBadge } from "../app/ui";
import { useCrm } from "../crm/CrmContext";
import {
  customerMono,
  formatDate,
  formatShortDate,
  monoGradient,
} from "../crm/helpers";

function CommitMeter({ total, closed }: { total: number; closed: number }) {
  if (!total) return null;
  const open = total - closed;
  const pct = Math.round((closed / total) * 100);
  const done = open === 0;
  return (
    <span className={`commit${done ? " done" : ""}`}>
      {done && <Icon name="check" />}
      <span className="bar">
        <i style={{ width: `${pct}%` }} />
      </span>
      {done ? "All commitments closed" : `${open} open · ${total} commitment${total > 1 ? "s" : ""}`}
    </span>
  );
}

export function ActivityFeed() {
  const crm = useCrm();
  const { stats, interactions, customers, customerById, engineerName } = useCrm();
  const { navigate } = useNav();

  const recent = [...interactions].sort((a, b) => +new Date(b.date) - +new Date(a.date));

  const openCommitments = interactions.reduce(
    (n, i) => n + i.actionItems.filter((a) => a.status !== "closed").length,
    0
  );

  const kpis: { label: string; value: number | undefined; unit?: string; delta: string; icon: IconName }[] = [
    { label: "Interactions", value: stats?.interactions, delta: "all-time", icon: "handshake" },
    { label: "Customers", value: stats?.teams, delta: `${customers.length} active`, icon: "customers" },
    { label: "Open commitments", value: openCommitments, delta: "across teams", icon: "check" },
    { label: "Last 30 days", value: stats?.last30, unit: "logged", delta: "recent activity", icon: "trend" },
  ];

  const counts: Record<string, number> = {};
  interactions.forEach((i) => (counts[i.gameTeamId] = (counts[i.gameTeamId] || 0) + 1));
  const mostActive = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const dueSoon = interactions
    .flatMap((i) =>
      i.actionItems
        .filter((a) => a.status !== "closed" && a.dueDate)
        .map((a) => ({ ...a, gameTeamId: i.gameTeamId }))
    )
    .sort((a, b) => +new Date(a.dueDate!) - +new Date(b.dueDate!))
    .slice(0, 5);

  return (
    <section>
      <div className="page-head">
        <div>
          <div className="eyebrow">Workspace</div>
          <h1 className="page-title">Activity Feed</h1>
          <div className="page-sub">
            Recent relationship activity across all {customers.length} customers MGT supports.
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => navigate("log", { editingInteractionId: null })}
        >
          <Icon name="plus" />
          Log Interaction
        </button>
      </div>

      <div className="kpi-grid">
        {kpis.map((k) => (
          <div className="kpi" key={k.label}>
            <div className="kpi-label">
              <Icon name={k.icon} />
              {k.label}
            </div>
            <div className="kpi-value">
              {k.value ?? "—"}
              {k.unit && <span className="unit">{k.unit}</span>}
            </div>
            <div className="kpi-delta up">
              <Icon name="trend" />
              <span className="muted">{k.delta}</span>
            </div>
          </div>
        ))}
      </div>

      {recent.length === 0 ? (
        <EmptyState
          message="No interactions logged yet."
          ctaLabel="Log your first interaction"
          onCta={() => navigate("log", { editingInteractionId: null })}
        />
      ) : (
        <div className="feed-layout">
          <div>
            <div className="col-head">
              <span>Recent interactions</span>
              <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>
                {recent.length} shown
              </span>
            </div>
            {recent.map((i) => {
              const team = customerById(i.gameTeamId);
              const mgt = i.attendeesMgt.map(engineerName).join(", ");
              const ext = i.attendeesExternal
                .map((id) => crm.contactById(id)?.name || "")
                .filter(Boolean)
                .join(", ");
              const closed = i.actionItems.filter((a) => a.status === "closed").length;
              return (
                <div
                  key={i.id}
                  className="card ix card-int"
                  onClick={() => navigate("s05", { currentTeamId: i.gameTeamId })}
                >
                  <div className="ix-head">
                    <div className="ix-title">{i.title}</div>
                    <div className="ix-date">{formatDate(i.date)}</div>
                  </div>
                  <div className="ix-meta">
                    <InteractionBadge type={i.type} />
                    <span className="sep">·</span>
                    <SentimentBadge sentiment={i.sentiment} />
                    <span className="sep">·</span>
                    <button
                      className="link"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate("s05", { currentTeamId: i.gameTeamId });
                      }}
                    >
                      {team?.name || i.gameTeamId}
                    </button>
                    <span className="sep">·</span>
                    <span>MGT: {mgt || "—"}</span>
                    {ext && (
                      <>
                        <span className="sep">·</span>
                        <span>Team: {ext}</span>
                      </>
                    )}
                  </div>
                  <InteractionNotes text={i.notes} clampLines={3} />
                  <div className="ix-foot">
                    <CommitMeter total={i.actionItems.length} closed={closed} />
                    {i.tags.length > 0 && (
                      <div className="chip-row">
                        {i.tags.map((t) => (
                          <span className="tag mono" key={t}>
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="stack">
            <div className="card side-card">
              <div className="col-head">
                <span>Most active</span>
              </div>
              {mostActive.map(([id, n]) => {
                const c = customerById(id);
                if (!c) return null;
                const h = crm.hierarchy(c);
                return (
                  <div
                    key={id}
                    className="side-row"
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate("s05", { currentTeamId: id })}
                  >
                    <div className="mono-badge" style={{ background: monoGradient(c.name) }}>
                      {customerMono(c.name)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="nm">{c.name}</div>
                      <div className="mt">
                        {h.subdivision} · {h.studio}
                      </div>
                    </div>
                    <div className="ct">{n}</div>
                  </div>
                );
              })}
            </div>

            <div className="card side-card">
              <div className="col-head">
                <span>Commitments due soon</span>
              </div>
              {dueSoon.length === 0 ? (
                <div className="text-sm text-secondary">No open commitments with due dates.</div>
              ) : (
                dueSoon.map((a, idx) => {
                  const c = customerById(a.gameTeamId);
                  return (
                    <div className="side-row" key={idx}>
                      <div style={{ minWidth: 0 }}>
                        <div
                          className="nm"
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: 200,
                          }}
                        >
                          {a.text}
                        </div>
                        <div className="mt">
                          {c?.name || "—"} · {a.ownerId ? engineerName(a.ownerId) : "Unassigned"}
                        </div>
                      </div>
                      <div className="ct">{formatShortDate(a.dueDate)}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
