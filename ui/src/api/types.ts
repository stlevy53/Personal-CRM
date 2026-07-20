// Mirrors the Go API JSON shapes (which mirror the prototype CRM.* contract).

export interface Subdivision {
  id: string;
  name: string;
}

export interface Studio {
  id: string;
  name: string;
  subdivisionId: string;
}

export interface AppStatus {
  key: string;
  label: string;
  badge: string;
}

export interface Pod {
  id: string;
  name: string;
}

export interface Person {
  id: string;
  name: string;
  initials: string;
  podId: string;
}

export interface TeamNote {
  id: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  studioId: string;
  appStatus: string;
  slackChannel: string;
  services: string[];
  contacts: string[];
  notes: TeamNote[];
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  slack: string;
  role: string;
  customerId: string;
}

export interface ActionItem {
  text: string;
  ownerId: string | null;
  dueDate: string | null;
  status: "open" | "in-progress" | "closed";
}

export type Sentiment = "positive" | "neutral" | "negative";

export interface Interaction {
  id: string;
  type: string;
  title: string;
  date: string;
  notes: string;
  sentiment: Sentiment;
  actionItems: ActionItem[];
  tags: string[];
  attendeesInternal: string[];
  attendeesExternal: string[];
  customerId: string;
  loggedBy: string;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actorId: string;
  action: string;
  recordType: string;
  recordId: string;
  detail: string;
}

export interface Stats {
  interactions: number;
  teams: number;
  contacts: number;
  last30: number;
}
