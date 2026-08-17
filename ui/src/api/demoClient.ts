// In-browser mock of the CRM.* client, used for the public GitHub Pages demo
// (VITE_DEMO_MODE=true). No network calls, no backend — everything lives in
// memory and resets on page reload. Implements the same shape as ./client.ts
// so every screen works unmodified.

import type {
  AppStatus,
  AuditEntry,
  Contact,
  Customer,
  Interaction,
  Person,
  Stats,
  Studio,
  Subdivision,
} from "./types";
import {
  DEMO_APP_STATUSES,
  DEMO_AUDIT,
  DEMO_CONTACTS,
  DEMO_CUSTOMERS,
  DEMO_INTERACTIONS,
  DEMO_PEOPLE,
  DEMO_PODS,
  DEMO_STUDIOS,
  DEMO_SUBDIVISIONS,
} from "./demoData";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

// Small artificial delay so loading states are visible, same as a real API call.
function wait<T>(value: T, ms = 220): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

const state = {
  subdivisions: clone(DEMO_SUBDIVISIONS),
  studios: clone(DEMO_STUDIOS),
  appStatuses: clone(DEMO_APP_STATUSES),
  people: clone(DEMO_PEOPLE),
  pods: clone(DEMO_PODS),
  customers: clone(DEMO_CUSTOMERS),
  contacts: clone(DEMO_CONTACTS),
  interactions: clone(DEMO_INTERACTIONS),
  audit: clone(DEMO_AUDIT),
};

function pushAudit(action: string, recordType: string, recordId: string, detail: string) {
  state.audit.unshift({
    id: randomId("a"),
    timestamp: new Date().toISOString(),
    actorId: "local-dev",
    action,
    recordType,
    recordId,
    detail,
  });
}

function computeStats(): Stats {
  const now = Date.now();
  const last30 = state.interactions.filter(
    (i) => now - new Date(i.date).getTime() <= 30 * 86_400_000
  ).length;
  return {
    interactions: state.interactions.length,
    teams: state.customers.length,
    contacts: state.contacts.length,
    last30,
  };
}

export const DemoCRM = {
  health: () => wait({ status: "ok", authEnabled: false }),

  customers: {
    list: () => wait(clone(state.customers)),
    get: (id: string) => {
      const found = state.customers.find((c) => c.id === id);
      if (!found) return Promise.reject(new Error(`API 404: customer ${id} not found`));
      return wait(clone(found));
    },
    create: (data: Partial<Customer>) => {
      const c: Customer = {
        id: randomId("cust"),
        name: data.name ?? "New Customer",
        studioId: data.studioId ?? state.studios[0]?.id ?? "",
        appStatus: data.appStatus ?? "prototype",
        slackChannel: data.slackChannel ?? "",
        services: data.services ?? [],
        contacts: [],
        notes: [],
      };
      state.customers.push(c);
      pushAudit("Customer Created", "Profile", c.id, `Created ${c.name}`);
      return wait(clone(c));
    },
    update: (id: string, data: Partial<Customer>) => {
      const idx = state.customers.findIndex((c) => c.id === id);
      if (idx === -1) return Promise.reject(new Error(`API 404: customer ${id} not found`));
      state.customers[idx] = { ...state.customers[idx], ...data };
      pushAudit("Customer Updated", "Profile", id, `Updated ${state.customers[idx].name}`);
      return wait(clone(state.customers[idx]));
    },
    addNote: (id: string, text: string, authorId: string) => {
      const idx = state.customers.findIndex((c) => c.id === id);
      if (idx === -1) return Promise.reject(new Error(`API 404: customer ${id} not found`));
      state.customers[idx].notes.push({
        id: randomId("note"),
        authorId,
        text,
        createdAt: new Date().toISOString(),
      });
      pushAudit("Team Note Added", "Profile", id, `Note added to ${state.customers[idx].name}`);
      return wait(clone(state.customers[idx]));
    },
  },

  contacts: {
    list: () => wait(clone(state.contacts)),
    create: (data: Partial<Contact>) => {
      const c: Contact = {
        id: randomId("contact"),
        name: data.name ?? "New Contact",
        email: data.email ?? "",
        slack: data.slack ?? "",
        role: data.role ?? "",
        customerId: data.customerId ?? "",
      };
      state.contacts.push(c);
      pushAudit("Contact Created", "Contact", c.id, `Created ${c.name}`);
      return wait(clone(c));
    },
    update: (id: string, data: Partial<Contact>) => {
      const idx = state.contacts.findIndex((c) => c.id === id);
      if (idx === -1) return Promise.reject(new Error(`API 404: contact ${id} not found`));
      state.contacts[idx] = { ...state.contacts[idx], ...data };
      return wait(clone(state.contacts[idx]));
    },
  },

  interactions: {
    list: (customerId?: string) =>
      wait(
        clone(
          customerId
            ? state.interactions.filter((i) => i.customerId === customerId)
            : state.interactions
        )
      ),
    get: (id: string) => {
      const found = state.interactions.find((i) => i.id === id);
      if (!found) return Promise.reject(new Error(`API 404: interaction ${id} not found`));
      return wait(clone(found));
    },
    create: (data: Partial<Interaction>) => {
      const i: Interaction = {
        id: randomId("INTR"),
        type: data.type ?? "other",
        title: data.title ?? "Untitled interaction",
        date: data.date ?? new Date().toISOString(),
        notes: data.notes ?? "",
        sentiment: data.sentiment ?? "neutral",
        actionItems: data.actionItems ?? [],
        tags: data.tags ?? [],
        attendeesInternal: data.attendeesInternal ?? [],
        attendeesExternal: data.attendeesExternal ?? [],
        customerId: data.customerId ?? "",
        loggedBy: data.loggedBy ?? "local-dev",
        createdAt: new Date().toISOString(),
      };
      state.interactions.unshift(i);
      pushAudit("Interaction Logged", "Interaction", i.id, `${i.type} - ${i.title}`);
      return wait(clone(i));
    },
    update: (id: string, data: Partial<Interaction>) => {
      const idx = state.interactions.findIndex((i) => i.id === id);
      if (idx === -1) return Promise.reject(new Error(`API 404: interaction ${id} not found`));
      state.interactions[idx] = { ...state.interactions[idx], ...data };
      return wait(clone(state.interactions[idx]));
    },
    setActionStatus: (id: string, index: number, status: string) => {
      const idx = state.interactions.findIndex((i) => i.id === id);
      if (idx === -1) return Promise.reject(new Error(`API 404: interaction ${id} not found`));
      const item = state.interactions[idx].actionItems[index];
      if (!item) return Promise.reject(new Error("Action item not found"));
      item.status = status as Interaction["actionItems"][number]["status"];
      return wait(clone(state.interactions[idx]));
    },
  },

  subdivisions: {
    list: () => wait(clone(state.subdivisions)),
    create: (name: string) => {
      const s: Subdivision = { id: randomId("sub"), name };
      state.subdivisions.push(s);
      return wait(clone(s));
    },
  },
  studios: {
    list: () => wait(clone(state.studios)),
    create: (name: string, subdivisionId: string) => {
      const s: Studio = { id: randomId("studio"), name, subdivisionId };
      state.studios.push(s);
      return wait(clone(s));
    },
  },
  appStatuses: {
    list: () => wait(clone(state.appStatuses)),
    create: (name: string) => {
      const s: AppStatus = { key: randomId("status"), label: name, badge: "badge-other" };
      state.appStatuses.push(s);
      return wait(clone(s));
    },
  },
  people: {
    list: () => wait(clone(state.people)),
    create: (name: string) => {
      const p: Person = {
        id: randomId("person"),
        name,
        initials: name.slice(0, 2).toUpperCase(),
        podId: state.pods[0]?.id ?? "",
      };
      state.people.push(p);
      return wait(clone(p));
    },
  },
  pods: { list: () => wait(clone(state.pods)) },
  audit: {
    list: () =>
      wait(
        clone(state.audit).sort(
          (a: AuditEntry, b: AuditEntry) => +new Date(b.timestamp) - +new Date(a.timestamp)
        )
      ),
  },
  stats: { get: () => wait(computeStats()) },
};
