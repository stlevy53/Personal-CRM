import type { Contact, Customer, Interaction } from "../api/types";
import { ACTION_STATUSES, formatDate, INTERACTION_TYPES } from "./helpers";

const DEFAULT_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

export interface AIConfig {
  apiKey: string;
  endpoint: string;
  model: string;
}

export function getConfig(): AIConfig {
  return {
    apiKey: localStorage.getItem("crm_ai_api_key") || "",
    endpoint: localStorage.getItem("crm_ai_endpoint") || DEFAULT_ENDPOINT,
    model: localStorage.getItem("crm_ai_model") || DEFAULT_MODEL,
  };
}

export function setConfig(cfg: Partial<AIConfig>) {
  if (cfg.apiKey !== undefined) localStorage.setItem("crm_ai_api_key", cfg.apiKey);
  if (cfg.endpoint !== undefined)
    localStorage.setItem("crm_ai_endpoint", cfg.endpoint || DEFAULT_ENDPOINT);
  if (cfg.model !== undefined) localStorage.setItem("crm_ai_model", cfg.model || DEFAULT_MODEL);
}

export function isConfigured(): boolean {
  return !!getConfig().apiKey;
}

export interface KnowledgeSnapshot {
  customers: Customer[];
  contacts: Contact[];
  interactions: Interaction[];
  engineerName: (id: string | null | undefined) => string;
  appStatusLabel: (key: string) => string;
  hierarchy: (c: Customer) => { subdivision: string; studio: string };
}

// Serialize the entire relationship dataset into a structured text knowledge base.
export function buildContext(snap: KnowledgeSnapshot): string {
  const lines: string[] = [];
  lines.push("# RELATIONSHIP KNOWLEDGE BASE");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");

  snap.customers.forEach((t) => {
    const h = snap.hierarchy(t);
    lines.push(`## CUSTOMER: ${t.name} (id: ${t.id})`);
    lines.push(`- Org hierarchy: Subdivision ${h.subdivision} > Studio ${h.studio}`);
    lines.push(`- App status: ${snap.appStatusLabel(t.appStatus)}`);
    lines.push(`- Primary Slack channel: ${t.slackChannel || "n/a"}`);

    const contacts = snap.contacts.filter((c) => c.customerId === t.id);
    if (contacts.length) {
      lines.push("- Contacts:");
      contacts.forEach((c) =>
        lines.push(`    - ${c.name} (${c.role}), email ${c.email}, slack ${c.slack}`)
      );
    }

    if (t.notes.length) {
      lines.push("- Relationship notes:");
      t.notes.forEach((n) =>
        lines.push(`    - [${formatDate(n.createdAt)}, ${snap.engineerName(n.authorId)}] ${n.text}`)
      );
    }

    const interactions = snap.interactions
      .filter((i) => i.customerId === t.id)
      .sort((a, b) => +new Date(b.date) - +new Date(a.date));
    if (interactions.length) {
      lines.push("- Logged interactions:");
      interactions.forEach((i) => {
        const internal = i.attendeesInternal.map(snap.engineerName).join(", ");
        const ext = i.attendeesExternal
          .map((id) => snap.contacts.find((c) => c.id === id)?.name || id)
          .join(", ");
        lines.push(
          `    - [${formatDate(i.date)}] ${INTERACTION_TYPES[i.type]?.label || "Other"}: "${i.title}"`
        );
        lines.push(`        Internal attendees: ${internal || "n/a"}; Contacts: ${ext || "n/a"}`);
        lines.push(`        Notes: ${i.notes}`);
        if (i.actionItems.length) {
          const ai = i.actionItems
            .map((a) => {
              const owner = a.ownerId ? snap.engineerName(a.ownerId) : "unassigned";
              const due = a.dueDate ? `, due ${a.dueDate}` : "";
              const status = ACTION_STATUSES[a.status]?.label || "Open";
              return `${a.text} (status: ${status}, owner: ${owner}${due})`;
            })
            .join("; ");
          lines.push(`        Action items: ${ai}`);
        }
        if (i.tags.length) lines.push(`        Tags: ${i.tags.join(", ")}`);
      });
    }
    lines.push("");
  });

  return lines.join("\n");
}

function systemPrompt(snap: KnowledgeSnapshot): string {
  return [
    "You are the Personal-CRM relationship intelligence assistant. You answer questions using ONLY the",
    "knowledge base below, which contains company/contact profiles, relationship notes, and logged",
    "interactions (meetings, calls, emails, messages).",
    "",
    "Guidelines:",
    "- Base every answer strictly on the knowledge base. If the information is not present, say so plainly.",
    '- Cite your sources inline using the interaction title and date, e.g. (Meeting "Q2 infrastructure planning sync", 2 days ago).',
    "- Be concise and structured. Use bullet points for lists of commitments, action items, or teams.",
    "- When asked about commitments or follow-ups, surface the relevant action items.",
    "",
    "=== KNOWLEDGE BASE START ===",
    buildContext(snap),
    "=== KNOWLEDGE BASE END ===",
  ].join("\n");
}

export async function search(query: string, snap: KnowledgeSnapshot): Promise<string> {
  const cfg = getConfig();
  if (!cfg.apiKey) throw new Error("No API key configured. Add one in Settings.");

  const res = await fetch(cfg.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt(snap) },
        { role: "user", content: query },
      ],
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json())?.error?.message || "";
    } catch {
      /* ignore */
    }
    throw new Error(`API error ${res.status}${detail ? ": " + detail : ""}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "(The model returned an empty response.)";
}
