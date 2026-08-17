// Static fixture data for the public GitHub Pages demo (VITE_DEMO_MODE=true).
// Ported from api/internal/seed/seed.sql — the same dataset used for local dev —
// with all dates made relative to "now" so the demo always looks current.
// No real customer, contact, or company data: names and companies are fictional.

import type {
  AppStatus,
  AuditEntry,
  Contact,
  Customer,
  Interaction,
  Person,
  Pod,
  Studio,
  Subdivision,
} from "./types";

/** ISO timestamp `n` days in the past (negative `n` = future). */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export const DEMO_PODS: Pod[] = [
  { id: "cloud-infra", name: "Cloud Infrastructure" },
  { id: "platform", name: "Platform Engineering" },
  { id: "devex", name: "Developer Experience" },
  { id: "data", name: "Data Platform" },
];

export const DEMO_PEOPLE: Person[] = [
  { id: "mp", name: "M. Patel", initials: "MP", podId: "cloud-infra" },
  { id: "sc", name: "S. Chen", initials: "SC", podId: "cloud-infra" },
  { id: "ar", name: "A. Rodriguez", initials: "AR", podId: "devex" },
  { id: "kw", name: "K. Williams", initials: "KW", podId: "platform" },
  { id: "jl", name: "J. Liu", initials: "JL", podId: "data" },
];

export const DEMO_APP_STATUSES: AppStatus[] = [
  { key: "prototype", label: "Prototype", badge: "badge-prototype" },
  { key: "pre-production", label: "Pre-Production", badge: "badge-preprod" },
  { key: "production", label: "Production", badge: "badge-prod" },
  { key: "soft-launch", label: "Soft Launch", badge: "badge-proto" },
  { key: "live-worldwide", label: "Live Worldwide", badge: "badge-live" },
  { key: "sunsetting", label: "Sunsetting", badge: "badge-sunsetting" },
  { key: "sunset", label: "Sunset", badge: "badge-sunset" },
];

export const DEMO_SUBDIVISIONS: Subdivision[] = [
  { id: "trinity", name: "Nova" },
  { id: "vertex", name: "Vertex" },
];

export const DEMO_STUDIOS: Studio[] = [
  { id: "atlas-studio", name: "Atlas Studio", subdivisionId: "trinity" },
  { id: "gram", name: "Halcyon Games", subdivisionId: "trinity" },
  { id: "vertex-casino", name: "Vertex Casino & Cards", subdivisionId: "vertex" },
  { id: "vertex-casual", name: "Vertex Casual", subdivisionId: "vertex" },
];

export const DEMO_CONTACTS: Contact[] = [
  { id: "je", name: "Jordan Ellis", email: "j.ellis@acme.example.com", slack: "@j_ellis", role: "Lead Engineer", customerId: "fv3" },
  { id: "pm-fv3", name: "Priya Mehta", email: "p.mehta@acme.example.com", slack: "@p_mehta", role: "DevOps Engineer", customerId: "fv3" },
  { id: "dk", name: "Daniel Kim", email: "d.kim@acme.example.com", slack: "@d_kim", role: "Engineering Manager", customerId: "fv3" },
  { id: "tc", name: "Tyler Chen", email: "t.chen@acme.example.com", slack: "@t_chen", role: "Senior Engineer", customerId: "poker" },
  { id: "sp", name: "Sara Park", email: "s.park@acme.example.com", slack: "@s_park", role: "DevOps Engineer", customerId: "poker" },
  { id: "rb", name: "Rachel Brooks", email: "r.brooks@acme.example.com", slack: "@r_brooks", role: "Lead Engineer", customerId: "wwf" },
  { id: "lp", name: "Luis Perez", email: "l.perez@acme.example.com", slack: "@l_perez", role: "Backend Engineer", customerId: "md" },
  { id: "em", name: "Emma Martinez", email: "e.martinez@acme.example.com", slack: "@e_martinez", role: "DevOps Engineer", customerId: "hpp" },
];

export const DEMO_CUSTOMERS: Customer[] = [
  {
    id: "fv3",
    name: "Frontier Quest 3",
    studioId: "atlas-studio",
    appStatus: "production",
    slackChannel: "#fv3-support",
    services: ["k8s", "aws", "obs", "ci"],
    contacts: ["je", "pm-fv3", "dk"],
    notes: [
      {
        id: "tn1",
        authorId: "sc",
        text: "FV3 team is ramping a new DevOps hire (start date April). Expect heavier questions on K8s and observability setup in Q2. Worth proactive outreach once they're onboarded.",
        createdAt: daysAgo(1),
      },
      {
        id: "tn2",
        authorId: "mp",
        text: "Recurring pattern: K8s resource limits questions stem from FV3 not yet using the self-service limit calculator in the portal. Onboarded Jordan on this. Should be less frequent now.",
        createdAt: daysAgo(15),
      },
      {
        id: "tn3",
        authorId: "ar",
        text: "Team went live Dec 2025. Good team, quick communicators. Primary contact Jordan Ellis is technically strong. Prefers Slack over email.",
        createdAt: daysAgo(85),
      },
    ],
  },
  {
    id: "poker",
    name: "Acme Poker",
    studioId: "vertex-casino",
    appStatus: "production",
    slackChannel: "#poker-support",
    services: ["aws", "db"],
    contacts: ["tc", "sp"],
    notes: [],
  },
  {
    id: "wwf",
    name: "Puzzle Pals 3",
    studioId: "vertex-casual",
    appStatus: "production",
    slackChannel: "#wwf-support",
    services: ["k8s", "obs"],
    contacts: ["rb"],
    notes: [],
  },
  {
    id: "md",
    name: "Merge Kingdoms!",
    studioId: "gram",
    appStatus: "pre-production",
    slackChannel: "#md-support",
    services: ["ci", "aws"],
    contacts: ["lp"],
    notes: [],
  },
  {
    id: "hpp",
    name: "Mystic Manor Puzzles",
    studioId: "vertex-casual",
    appStatus: "pre-production",
    slackChannel: "#hpp-support",
    services: ["aws", "ci"],
    contacts: ["em"],
    notes: [],
  },
];

export const DEMO_INTERACTIONS: Interaction[] = [
  {
    id: "INTR-0012",
    type: "meeting",
    title: "Q2 infrastructure planning sync",
    date: daysAgo(2),
    notes: "Reviewed FV3 Q2 roadmap. They are planning a major LiveOps event in May expecting ~2x peak concurrency (target 700k CCU). Discussed pre-scaling the HPA and reserving additional node capacity. Priya raised that their current observability dashboards do not surface per-region latency, which makes incident triage slow. We committed to helping them set up regional latency panels before the event.",
    sentiment: "neutral",
    actionItems: [
      { text: "Provision additional node capacity for the May event", ownerId: "mp", dueDate: daysAgo(-14), status: "open" },
      { text: "Help FV3 build per-region latency dashboards", ownerId: "sc", dueDate: daysAgo(-21), status: "open" },
      { text: "Schedule load test two weeks before the event", ownerId: "mp", dueDate: daysAgo(-18), status: "open" },
    ],
    tags: ["liveops", "scaling", "observability", "q2-planning"],
    attendeesInternal: ["mp", "sc"],
    attendeesExternal: ["je", "pm-fv3"],
    customerId: "fv3",
    loggedBy: "mp",
    createdAt: daysAgo(2),
  },
  {
    id: "INTR-0011",
    type: "call",
    title: "Onboarding new DevOps hire",
    date: daysAgo(5),
    notes: "Intro call with FV3 about their incoming DevOps engineer starting in April. Daniel wants us to run a half-day onboarding session covering our K8s self-service tooling, the limit calculator, and CI/CD pipeline conventions. Good opportunity to reduce repeat questions.",
    sentiment: "positive",
    actionItems: [
      { text: "Prepare onboarding deck for new FV3 hire", ownerId: "mp", dueDate: daysAgo(-3), status: "open" },
      { text: "Book half-day session for late April", ownerId: "mp", dueDate: null, status: "open" },
    ],
    tags: ["onboarding", "enablement"],
    attendeesInternal: ["mp"],
    attendeesExternal: ["dk"],
    customerId: "fv3",
    loggedBy: "mp",
    createdAt: daysAgo(5),
  },
  {
    id: "INTR-0010",
    type: "meeting",
    title: "Poker DB scaling review",
    date: daysAgo(6),
    notes: "Acme Poker is seeing connection pool pressure during peak tournaments. Walked through read-replica options and connection pooling (PgBouncer) with Tyler. They are interested but want a cost estimate before committing. Sara will share their current connection metrics so we can right-size.",
    sentiment: "neutral",
    actionItems: [
      { text: "Provide cost estimate for read replicas", ownerId: "jl", dueDate: daysAgo(-6), status: "open" },
      { text: "Sara to share connection pool metrics", ownerId: null, dueDate: null, status: "open" },
      { text: "Evaluate PgBouncer rollout", ownerId: "jl", dueDate: null, status: "open" },
    ],
    tags: ["database", "scaling", "cost"],
    attendeesInternal: ["jl"],
    attendeesExternal: ["tc", "sp"],
    customerId: "poker",
    loggedBy: "jl",
    createdAt: daysAgo(6),
  },
  {
    id: "INTR-0009",
    type: "slack",
    title: "WWF2 observability dashboard gap",
    date: daysAgo(8),
    notes: "Rachel pinged about custom game metrics disappearing from dashboards after their last deploy. Root cause was a renamed metric prefix. Helped them update the dashboard queries. Flagged that they should pin metric names in their instrumentation config to avoid this recurring.",
    sentiment: "negative",
    actionItems: [
      { text: "WWF2 to pin metric names in config", ownerId: null, dueDate: null, status: "open" },
    ],
    tags: ["observability", "incident"],
    attendeesInternal: ["kw"],
    attendeesExternal: ["rb"],
    customerId: "wwf",
    loggedBy: "kw",
    createdAt: daysAgo(8),
  },
  {
    id: "INTR-0008",
    type: "meeting",
    title: "Merge Kingdoms pre-production readiness",
    date: daysAgo(12),
    notes: "Merge Kingdoms is moving from prototype to pre-production. Reviewed their CI/CD setup - currently build times are ~30min which will slow them down. Recommended migrating to our Anvil remote cache. Luis is keen. Also discussed AWS account structure for their staging environment.",
    sentiment: "positive",
    actionItems: [
      { text: "Help MD migrate to Anvil remote build cache", ownerId: null, dueDate: null, status: "open" },
      { text: "Set up dedicated staging AWS account", ownerId: null, dueDate: null, status: "open" },
      { text: "Follow up on namespace quota needs", ownerId: null, dueDate: null, status: "open" },
    ],
    tags: ["ci-cd", "pre-production", "aws"],
    attendeesInternal: ["ar", "sc"],
    attendeesExternal: ["lp"],
    customerId: "md",
    loggedBy: "ar",
    createdAt: daysAgo(12),
  },
  {
    id: "INTR-0007",
    type: "call",
    title: "Mystic Manor Puzzles kickoff",
    date: daysAgo(18),
    notes: "First infrastructure planning call with HPP. They are in pre-production targeting a soft launch in Q3. Need AWS provisioning and a CI/CD pipeline. Emma is the main technical contact. Walked through our standard pre-production onboarding checklist.",
    sentiment: "positive",
    actionItems: [
      { text: "Send HPP pre-production onboarding checklist", ownerId: null, dueDate: null, status: "closed" },
      { text: "Provision initial AWS account", ownerId: null, dueDate: null, status: "in-progress" },
      { text: "Schedule CI/CD setup session", ownerId: null, dueDate: null, status: "open" },
    ],
    tags: ["onboarding", "pre-production", "aws", "ci-cd"],
    attendeesInternal: ["sc", "ar"],
    attendeesExternal: ["em"],
    customerId: "hpp",
    loggedBy: "sc",
    createdAt: daysAgo(18),
  },
  {
    id: "INTR-0006",
    type: "meeting",
    title: "FV3 incident retro - autoscaler outage",
    date: daysAgo(22),
    notes: "Post-incident review of the HPA scaling failure that impacted ~340k players. Root cause was a metrics-server certificate expiry that blocked custom metric scraping. Agreed on action items: add cert expiry alerting, document the runbook, and add a synthetic check for the metrics pipeline.",
    sentiment: "negative",
    actionItems: [
      { text: "Add certificate expiry alerting", ownerId: null, dueDate: null, status: "closed" },
      { text: "Write autoscaler runbook", ownerId: null, dueDate: null, status: "closed" },
      { text: "Add synthetic check for metrics pipeline", ownerId: null, dueDate: null, status: "in-progress" },
    ],
    tags: ["incident", "retro", "kubernetes", "reliability"],
    attendeesInternal: ["mp", "sc"],
    attendeesExternal: ["je", "pm-fv3", "dk"],
    customerId: "fv3",
    loggedBy: "mp",
    createdAt: daysAgo(22),
  },
  {
    id: "INTR-0004",
    type: "email",
    title: "Poker observability alert tuning",
    date: daysAgo(38),
    notes: "Email thread with Sara about alert thresholds being too noisy after their game relaunch. Adjusted thresholds for CPU and latency alerts. Recommended they adopt our standard alerting profile for production games.",
    sentiment: "neutral",
    actionItems: [
      { text: "Apply standard production alerting profile to Poker", ownerId: null, dueDate: null, status: "closed" },
    ],
    tags: ["observability", "alerting"],
    attendeesInternal: ["kw"],
    attendeesExternal: ["sp"],
    customerId: "poker",
    loggedBy: "kw",
    createdAt: daysAgo(38),
  },
  {
    id: "INTR-0003",
    type: "meeting",
    title: "WWF2 quarterly relationship check-in",
    date: daysAgo(45),
    notes: "Quarterly check-in with Rachel. Overall WWF2 is happy with platform stability. They flagged interest in adopting our new observability tracing features. No urgent issues. Good relationship, low-maintenance team.",
    sentiment: "positive",
    actionItems: [
      { text: "Share observability tracing rollout timeline with WWF2", ownerId: null, dueDate: null, status: "closed" },
    ],
    tags: ["check-in", "relationship", "observability"],
    attendeesInternal: ["kw", "mp"],
    attendeesExternal: ["rb"],
    customerId: "wwf",
    loggedBy: "mp",
    createdAt: daysAgo(45),
  },
  {
    id: "INTR-0002",
    type: "call",
    title: "FV3 CI build time regression",
    date: daysAgo(60),
    notes: "Jordan reported CI build times regressed from 12min to 45min after a toolchain upgrade. Diagnosed a cache invalidation issue in the build config. Helped them restore remote cache hits. Build times back to ~14min.",
    sentiment: "negative",
    actionItems: [
      { text: "Document cache config best practices", ownerId: null, dueDate: null, status: "closed" },
    ],
    tags: ["ci-cd", "performance"],
    attendeesInternal: ["ar"],
    attendeesExternal: ["je"],
    customerId: "fv3",
    loggedBy: "ar",
    createdAt: daysAgo(60),
  },
  {
    id: "INTR-0001",
    type: "meeting",
    title: "Poker DB connection pool incident review",
    date: daysAgo(72),
    notes: "Reviewed a critical incident where the Poker DB connection pool hit max connections during a peak tournament. Implemented an emergency pool size increase. Longer term, this is what kicked off the read-replica conversation. Tyler very engaged.",
    sentiment: "negative",
    actionItems: [
      { text: "Plan read-replica architecture for Poker", ownerId: null, dueDate: null, status: "in-progress" },
    ],
    tags: ["database", "incident", "scaling"],
    attendeesInternal: ["jl"],
    attendeesExternal: ["tc"],
    customerId: "poker",
    loggedBy: "jl",
    createdAt: daysAgo(72),
  },
];

export const DEMO_AUDIT: AuditEntry[] = [
  { id: "a1", timestamp: daysAgo(2), actorId: "mp", action: "Interaction Logged", recordType: "Interaction", recordId: "INTR-0012", detail: "Meeting - Frontier Quest 3" },
  { id: "a2", timestamp: daysAgo(5), actorId: "mp", action: "Interaction Logged", recordType: "Interaction", recordId: "INTR-0011", detail: "Call - Frontier Quest 3" },
  { id: "a3", timestamp: daysAgo(6), actorId: "jl", action: "Interaction Logged", recordType: "Interaction", recordId: "INTR-0010", detail: "Meeting - Acme Poker" },
  { id: "a4", timestamp: daysAgo(1), actorId: "sc", action: "Team Note Added", recordType: "Profile", recordId: "fv3", detail: "Note added to Frontier Quest 3" },
  { id: "a5", timestamp: daysAgo(8), actorId: "kw", action: "Interaction Logged", recordType: "Interaction", recordId: "INTR-0009", detail: "Slack - Puzzle Pals 3" },
];
