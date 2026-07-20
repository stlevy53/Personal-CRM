import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CRM } from "../api/client";
import type {
  AppStatus,
  AuditEntry,
  Contact,
  Customer,
  Interaction,
  Person,
  Pod,
  Stats,
  Studio,
  Subdivision,
} from "../api/types";

interface CrmData {
  loading: boolean;
  error: string | null;

  subdivisions: Subdivision[];
  studios: Studio[];
  appStatuses: AppStatus[];
  people: Person[];
  pods: Pod[];
  customers: Customer[];
  contacts: Contact[];
  interactions: Interaction[];
  audit: AuditEntry[];
  stats: Stats | null;

  // lookups
  engineerName: (id: string | null | undefined) => string;
  studioName: (id: string) => string;
  subdivisionName: (id: string) => string;
  studioSubdivisionId: (studioId: string) => string | null;
  hierarchy: (c: Customer) => { subdivision: string; studio: string; label: string };
  appStatusMeta: (key: string) => { label: string; badge: string };
  customerById: (id: string) => Customer | undefined;
  contactById: (id: string) => Contact | undefined;
  interactionsByTeam: (teamId: string) => Interaction[];
  contactsByTeam: (teamId: string) => Contact[];

  // refreshers
  reloadCustomers: () => Promise<void>;
  reloadContacts: () => Promise<void>;
  reloadInteractions: () => Promise<void>;
  reloadAudit: () => Promise<void>;
  reloadStats: () => Promise<void>;
  reloadOrg: () => Promise<void>;
  reloadPeople: () => Promise<void>;
}

const CrmCtx = createContext<CrmData | null>(null);

export function CrmProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [subdivisions, setSubdivisions] = useState<Subdivision[]>([]);
  const [studios, setStudios] = useState<Studio[]>([]);
  const [appStatuses, setAppStatuses] = useState<AppStatus[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  const reloadCustomers = useCallback(async () => setCustomers(await CRM.customers.list()), []);
  const reloadContacts = useCallback(async () => setContacts(await CRM.contacts.list()), []);
  const reloadInteractions = useCallback(
    async () => setInteractions(await CRM.interactions.list()),
    []
  );
  const reloadAudit = useCallback(async () => setAudit(await CRM.audit.list()), []);
  const reloadStats = useCallback(async () => setStats(await CRM.stats.get()), []);
  const reloadOrg = useCallback(async () => {
    const [s, st, a] = await Promise.all([
      CRM.subdivisions.list(),
      CRM.studios.list(),
      CRM.appStatuses.list(),
    ]);
    setSubdivisions(s);
    setStudios(st);
    setAppStatuses(a);
  }, []);
  const reloadPeople = useCallback(async () => setPeople(await CRM.people.list()), []);

  useEffect(() => {
    (async () => {
      try {
        const [sub, st, app, ppl, pod, cust, con, intr, aud, stat] = await Promise.all([
          CRM.subdivisions.list(),
          CRM.studios.list(),
          CRM.appStatuses.list(),
          CRM.people.list(),
          CRM.pods.list(),
          CRM.customers.list(),
          CRM.contacts.list(),
          CRM.interactions.list(),
          CRM.audit.list(),
          CRM.stats.get(),
        ]);
        setSubdivisions(sub);
        setStudios(st);
        setAppStatuses(app);
        setPeople(ppl);
        setPods(pod);
        setCustomers(cust);
        setContacts(con);
        setInteractions(intr);
        setAudit(aud);
        setStats(stat);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo<CrmData>(() => {
    const studioOf = (id: string) => studios.find((s) => s.id === id);
    const subById = (id: string) => subdivisions.find((s) => s.id === id);

    return {
      loading,
      error,
      subdivisions,
      studios,
      appStatuses,
      people,
      pods,
      customers,
      contacts,
      interactions,
      audit,
      stats,

      engineerName: (id) => (id ? people.find((p) => p.id === id)?.name || id : "Unknown"),
      studioName: (id) => studioOf(id)?.name || id,
      subdivisionName: (id) => subById(id)?.name || id,
      studioSubdivisionId: (studioId) => studioOf(studioId)?.subdivisionId || null,
      hierarchy: (c) => {
        const studio = studioOf(c.studioId);
        const sub = studio ? subById(studio.subdivisionId) : undefined;
        return {
          subdivision: sub?.name || "—",
          studio: studio?.name || "—",
          label: [sub?.name, studio?.name].filter(Boolean).join(" › "),
        };
      },
      appStatusMeta: (key) => {
        const found = appStatuses.find((a) => a.key === key);
        return found ? { label: found.label, badge: found.badge } : { label: key, badge: "badge-other" };
      },
      customerById: (id) => customers.find((c) => c.id === id),
      contactById: (id) => contacts.find((c) => c.id === id),
      interactionsByTeam: (teamId) =>
        interactions
          .filter((i) => i.customerId === teamId)
          .sort((a, b) => +new Date(b.date) - +new Date(a.date)),
      contactsByTeam: (teamId) => contacts.filter((c) => c.customerId === teamId),

      reloadCustomers,
      reloadContacts,
      reloadInteractions,
      reloadAudit,
      reloadStats,
      reloadOrg,
      reloadPeople,
    };
  }, [
    loading,
    error,
    subdivisions,
    studios,
    appStatuses,
    people,
    pods,
    customers,
    contacts,
    interactions,
    audit,
    stats,
    reloadCustomers,
    reloadContacts,
    reloadInteractions,
    reloadAudit,
    reloadStats,
    reloadOrg,
    reloadPeople,
  ]);

  return <CrmCtx.Provider value={value}>{children}</CrmCtx.Provider>;
}

export function useCrm(): CrmData {
  const ctx = useContext(CrmCtx);
  if (!ctx) throw new Error("useCrm must be used within CrmProvider");
  return ctx;
}
