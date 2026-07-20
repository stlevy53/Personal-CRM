// Pure display helpers ported from assets/js/data.js (no data dependencies).

export const PUBLISHER = "Acme Games";

export const INTERACTION_TYPES: Record<string, { label: string; badge: string }> = {
  meeting: { label: "Meeting", badge: "badge-meeting" },
  call: { label: "Call", badge: "badge-call" },
  email: { label: "Email", badge: "badge-email" },
  slack: { label: "Slack", badge: "badge-slack" },
  other: { label: "Other", badge: "badge-other" },
};

export const ACTION_STATUSES: Record<string, { label: string; badge: string }> = {
  open: { label: "Open", badge: "badge-other" },
  "in-progress": { label: "In Progress", badge: "badge-meeting" },
  closed: { label: "Closed", badge: "badge-prod" },
};

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = (Date.now() - date.getTime()) / 86_400_000;
  if (diff < 1) return "Today";
  if (diff < 2) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatAuditTime(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function truncate(str: string, n: number): string {
  if (!str) return "";
  return str.length > n ? str.slice(0, n).trimEnd() + "…" : str;
}

// Up-to-2-char initials for the customer monogram (e.g. "Frontier Quest 3" -> "F3").
export function monogram(name: string): string {
  const words = (name || "").trim().split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// Customer badge initials: first letters of the first two words (one word -> 1 char).
export function customerMono(name: string): string {
  const w = (name || "").trim().split(/\s+/);
  return ((w[0]?.[0] || "") + (w[1]?.[0] || "")).toUpperCase() || "?";
}

// Person avatar initials: first + last initial, single word -> first two chars.
export function personInitials(name: string): string {
  const w = (name || "").trim().split(/\s+/);
  return ((w[0]?.[0] || "") + (w[1]?.[0] || w[0]?.[1] || "")).toUpperCase() || "?";
}

// Deterministic hue (0-359) derived from a name, for stable monogram gradients.
export function hueFromName(str: string): number {
  let h = 0;
  for (let i = 0; i < (str || "").length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
}

// CSS gradient background for a name's monogram/avatar.
export function monoGradient(name: string): string {
  const x = hueFromName(name || "");
  return `linear-gradient(150deg, oklch(0.58 0.13 ${x}), oklch(0.5 0.14 ${(x + 24) % 360}))`;
}

// Compact relative date, e.g. "today", "3d ago", "2w ago", "4mo ago".
export function relativeDate(d: string | Date | null | undefined): string {
  if (!d) return "no activity";
  const date = typeof d === "string" ? new Date(d) : d;
  const days = Math.round((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// Short date without the year, e.g. "Apr 28".
export function formatShortDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function interactionTypeMeta(type: string) {
  return INTERACTION_TYPES[type] ?? INTERACTION_TYPES.other;
}

export const SENTIMENTS: Record<string, { label: string; icon: "positive" | "neutral" | "negative" }> = {
  positive: { label: "Positive", icon: "positive" },
  neutral: { label: "Neutral", icon: "neutral" },
  negative: { label: "Negative", icon: "negative" },
};

export function sentimentMeta(sentiment: string) {
  return SENTIMENTS[sentiment] ?? SENTIMENTS.neutral;
}
