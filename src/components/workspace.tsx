"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { signOut } from "firebase/auth";
import {
  LayoutDashboard,
  Library,
  Network,
  ScanLine,
  Settings,
  Plus,
  Search,
  ArrowUpRight,
  ChevronRight,
  GitBranch,
  Box,
  Package,
  Bug,
  FileCheck2,
  FileText,
  MessageSquare,
  Link2,
  PanelRightClose,
  PanelRightOpen,
  LogOut,
  ArrowRight,
  RotateCcw,
  Pencil,
  Trash2,
  X,
  LoaderCircle,
  Check,
  Menu,
  Play,
  Pause,
  CornerDownLeft,
  FolderPlus,
} from "lucide-react";
import { Brand } from "./brand";
import { useAuth } from "./auth-provider";
import { RecordEditor, ProjectEditor, RelationshipEditor } from "./editors";
import { Dialog } from "./dialog";
import { AnswerView, type Explanation } from "./answer";
import { clientAuth, firebaseConfigured } from "@/lib/firebase";
import {
  kinds,
  label,
  checkRelationship,
  type Snapshot,
  type Project,
  type MemoryRecord,
  type Kind,
  type Relationship,
} from "@/lib/model";
import { makeDemo, demoQuestion } from "@/lib/demo";
import { retrieve, demoAnswer } from "@/lib/retrieval";
import { loadLocal, saveLocal } from "@/lib/local";
const Graph = dynamic(() => import("./graph"), {
  ssr: false,
  loading: () => (
    <div className="loading-block">
      <LoaderCircle className="spin" aria-hidden="true" /> Loading graph…
    </div>
  ),
});
const navigation = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "memory", label: "Memory", icon: Library },
  { id: "graph", label: "Graph", icon: Network },
  { id: "debug", label: "Debug assistant", icon: ScanLine },
  { id: "settings", label: "Settings", icon: Settings },
];
const icons = {
  Component: Box,
  Dependency: Package,
  Decision: GitBranch,
  Reason: MessageSquare,
  Bug,
  Fix: FileCheck2,
  Evidence: FileText,
};
type Modal =
  | { type: "record"; record?: MemoryRecord }
  | { type: "project"; project?: Project }
  | { type: "relationship" }
  | {
      type: "confirm";
      title: string;
      description: string;
      action: () => Promise<void>;
    };
const today = () => new Date().toISOString();
const niceField = (v: string) =>
  v.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
export default function Workspace() {
  const params = useSearchParams(),
    router = useRouter(),
    { user, ready } = useAuth();
  const demo = params.get("mode") === "demo",
    tab = navigation.some((n) => n.id === params.get("tab"))
      ? params.get("tab")!
      : "graph";
  const projectId = params.get("project") || "",
    selectedId = params.get("record") || "",
    query = params.get("q") || "",
    filter = params.get("type") || "all";
  const [locals, setLocals] = useState<Snapshot[]>([]),
    [projects, setProjects] = useState<Project[]>([]),
    [remote, setRemote] = useState<Snapshot | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [askError, setAskError] = useState(""),
    [notice, setNotice] = useState(""),
    [reload, setReload] = useState(0);
  const [modal, setModal] = useState<Modal | null>(null),
    [menu, setMenu] = useState(false),
    [panel, setPanel] = useState(true),
    [compact, setCompact] = useState(false),
    [panelTab, setPanelTab] = useState<"record" | "answer">("record");
  const [question, setQuestion] = useState(demoQuestion),
    [asking, setAsking] = useState(false),
    [result, setResult] = useState<Explanation | null>(null),
    [pathPlaying, setPathPlaying] = useState(true),
    [confirmBusy, setConfirmBusy] = useState(false),
    [confirmError, setConfirmError] = useState(""),
    [config, setConfig] = useState<Record<string, boolean> | null>(null);
  const activeProjectRef = useRef("");
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width:1050px)");
    const change = () => {
      setCompact(media.matches);
      setPanel(!media.matches);
    };
    Promise.resolve().then(change);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !modal &&
        !menu &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement).tagName,
        )
      ) {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('[name="search"]')?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [modal, menu]);
  useEffect(() => {
    if (!panel || !compact) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previous = document.activeElement as HTMLElement;
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !modal) {
        setPanel(false);
        previous?.focus();
      }
      if (e.key === "Tab" && !modal) {
        const items = Array.from(
          panelRef.current?.querySelectorAll<HTMLElement>(
            "button,a[href],summary",
          ) || [],
        );
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [panel, compact, modal]);
  const updateUrl = useCallback(
    (values: Record<string, string | null>) => {
      const next = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(values)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      router.replace(`/app?${next}`, { scroll: false });
    },
    [router],
  );
  const request = useCallback(
    async <T,>(path: string, method = "GET", data?: unknown): Promise<T> => {
      if (!user) throw new Error("Sign in before accessing your project.");
      const token = await user.getIdToken();
      const response = await fetch(`/api/${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(data ? { "Content-Type": "application/json" } : {}),
        },
        ...(data ? { body: JSON.stringify(data) } : {}),
      });
      const json = await response.json();
      if (!response.ok)
        throw new Error(
          json.issues?.length
            ? json.issues
                .map(
                  (i: { path: string; message: string }) =>
                    `${i.path}: ${i.message}`,
                )
                .join(" · ")
            : json.error || "Request failed. Retry.",
        );
      return json;
    },
    [user],
  );
  useEffect(() => {
    let live = true;
    fetch("/api/config")
      .then((r) => r.json())
      .then((c) => {
        if (live) setConfig(c);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    let live = true;
    Promise.resolve().then(async () => {
      if (!live) return;
      setLoading(true);
      setError("");
      setRemote(null);
      setResult(null);
      if (demo) {
        try {
          const local = loadLocal();
          if (live) {
            setLocals(local);
            setProjects(local.map((s) => s.project));
          }
        } catch {
          if (live)
            setError(
              "Local demo data could not be read. Open Settings to reset the demo.",
            );
        } finally {
          if (live) setLoading(false);
        }
        return;
      }
      if (!ready) return;
      if (!user) {
        if (live) setLoading(false);
        return;
      }
      try {
        const list = await request<Project[]>("projects");
        if (live) setProjects(list);
      } catch (e) {
        if (live)
          setError(
            e instanceof Error ? e.message : "Could not load projects. Retry.",
          );
      } finally {
        if (live) setLoading(false);
      }
    });
    return () => {
      live = false;
    };
  }, [demo, user, ready, request, reload]);
  const selectedProjectId = projects.some((p) => p.id === projectId)
    ? projectId
    : projects[0]?.id || "";
  useEffect(() => {
    let live = true;
    activeProjectRef.current = selectedProjectId;
    Promise.resolve().then(async () => {
      if (!live) return;
      setResult(null);
      setPanelTab("record");
      setAskError("");
      if (demo || !selectedProjectId || !user) return;
      setError("");
      setLoading(true);
      setRemote(null);
      try {
        const snapshot = await request<Snapshot>(
          `projects/${selectedProjectId}`,
        );
        if (live) setRemote(snapshot);
      } catch (e) {
        if (live)
          setError(
            e instanceof Error ? e.message : "Could not load project. Retry.",
          );
      } finally {
        if (live) setLoading(false);
      }
    });
    return () => {
      live = false;
    };
  }, [selectedProjectId, demo, user, request, reload]);
  const data = demo
    ? locals.find((s) => s.project.id === selectedProjectId) || null
    : remote;
  const selected =
    data?.records.find((r) => r.id === selectedId) ||
    data?.records.find((r) => r.kind === "Decision");
  const visible = useMemo(
    () =>
      data?.records.filter(
        (r) =>
          (filter === "all" || r.kind === filter) &&
          JSON.stringify(r.fields).toLowerCase().includes(query.toLowerCase()),
      ) || [],
    [data, filter, query],
  );
  const select = useCallback(
    (id: string) => {
      updateUrl({ record: id });
      setPanel(true);
      setPanelTab("record");
    },
    [updateUrl],
  );
  const selectGraphNode = useCallback(
    (id: string) => updateUrl({ record: id }),
    [updateUrl],
  );
  function persist(next: Snapshot[]) {
    try {
      saveLocal(next);
    } catch {
      throw new Error(
        "Browser storage is full or unavailable. Your change was not saved. Free space and retry.",
      );
    }
    setLocals(next);
    setProjects(next.map((s) => s.project));
  }
  function localUpdate(next: Snapshot) {
    persist(locals.map((s) => (s.project.id === next.project.id ? next : s)));
  }
  async function refresh() {
    if (!demo && selectedProjectId) {
      setRemote(await request<Snapshot>(`projects/${selectedProjectId}`));
      setProjects(await request<Project[]>("projects"));
    }
  }
  async function saveRecord(
    input: { kind: Kind; fields: Record<string, string> },
    record?: MemoryRecord,
  ) {
    if (!data) return;
    if (demo) {
      if (!record && data.records.length >= 500)
        throw new Error("This demo supports up to 500 records per project.");
      const next = {
        id: record?.id || crypto.randomUUID(),
        projectId: data.project.id,
        updatedAt: today(),
        ...input,
      };
      localUpdate({
        ...data,
        records: record
          ? data.records.map((r) => (r.id === record.id ? next : r))
          : [next, ...data.records],
      });
      select(next.id);
    } else {
      const next = await request<MemoryRecord>(
        `projects/${data.project.id}/records${record ? `/${record.id}` : ""}`,
        record ? "PATCH" : "POST",
        input,
      );
      await refresh();
      select(next.id);
    }
    setResult(null);
    setNotice("Memory record saved.");
  }
  async function saveProject(
    input: { name: string; description: string },
    project?: Project,
  ) {
    if (demo) {
      if (project) {
        persist(
          locals.map((s) =>
            s.project.id === project.id
              ? {
                  ...s,
                  project: { ...s.project, ...input, updatedAt: today() },
                }
              : s,
          ),
        );
      } else {
        const next: Snapshot = {
          project: {
            id: crypto.randomUUID(),
            ...input,
            synthetic: true,
            createdAt: today(),
            updatedAt: today(),
          },
          records: [],
          relationships: [],
        };
        persist([...locals, next]);
        updateUrl({ project: next.project.id, record: null });
      }
    } else {
      if (project) {
        await request(`projects/${project.id}`, "PATCH", input);
        await refresh();
      } else {
        const p = await request<Project>("projects", "POST", input);
        setProjects(await request<Project[]>("projects"));
        updateUrl({ project: p.id, record: null });
      }
    }
    setNotice("Project saved.");
  }
  async function saveRelationship(input: {
    source: string;
    target: string;
    type: string;
  }) {
    if (!data) return;
    checkRelationship(
      data.project.id,
      data.records.find((r) => r.id === input.source),
      data.records.find((r) => r.id === input.target),
      input.type,
    );
    if (demo) {
      if (data.relationships.length >= 2000)
        throw new Error("This demo supports up to 2,000 relationships.");
      if (
        !data.relationships.some(
          (e) =>
            e.source === input.source &&
            e.target === input.target &&
            e.type === input.type,
        )
      )
        localUpdate({
          ...data,
          relationships: [
            ...data.relationships,
            { id: crypto.randomUUID(), projectId: data.project.id, ...input },
          ],
        });
    } else {
      await request(`projects/${data.project.id}/relationships`, "POST", input);
      await refresh();
    }
    setResult(null);
    setNotice("Records connected.");
  }
  function confirm(
    title: string,
    description: string,
    action: () => Promise<void>,
  ) {
    setConfirmError("");
    setModal({ type: "confirm", title, description, action });
  }
  function removeRecord(r: MemoryRecord) {
    confirm(
      "Delete Memory Record?",
      `Delete “${label(r)}” and its relationships? This cannot be undone.`,
      async () => {
        if (!data) return;
        if (demo)
          localUpdate({
            ...data,
            records: data.records.filter((v) => v.id !== r.id),
            relationships: data.relationships.filter(
              (e) => e.source !== r.id && e.target !== r.id,
            ),
          });
        else {
          await request(
            `projects/${data.project.id}/records/${r.id}`,
            "DELETE",
          );
          await refresh();
        }
        updateUrl({ record: null });
        setResult(null);
        setNotice("Record deleted.");
      },
    );
  }
  function removeRelationship(e: Relationship) {
    confirm(
      "Delete Relationship?",
      "Remove this connection? Both memory records will be kept.",
      async () => {
        if (!data) return;
        if (demo)
          localUpdate({
            ...data,
            relationships: data.relationships.filter((v) => v.id !== e.id),
          });
        else {
          await request(
            `projects/${data.project.id}/relationships/${e.id}`,
            "DELETE",
          );
          await refresh();
        }
        setResult(null);
        setNotice("Relationship deleted.");
      },
    );
  }
  function removeProject() {
    if (!data) return;
    const id = data.project.id;
    confirm(
      "Delete Project?",
      `Delete “${data.project.name}” and all of its memory? This cannot be undone.`,
      async () => {
        if (demo) persist(locals.filter((s) => s.project.id !== id));
        else {
          await request(`projects/${id}`, "DELETE");
          setProjects(await request<Project[]>("projects"));
          setRemote(null);
        }
        setResult(null);
        updateUrl({ project: null, record: null });
        setNotice("Project deleted.");
      },
    );
  }
  async function seed() {
    setError("");
    setLoading(true);
    try {
      if (demo) {
        const next = makeDemo(`local-${crypto.randomUUID()}`);
        persist([...locals, next]);
        updateUrl({ project: next.project.id, record: null });
      } else {
        const p = await request<Project>("seed", "POST");
        setProjects(await request<Project[]>("projects"));
        updateUrl({ project: p.id, record: null });
      }
      setNotice("Synthetic sample project created.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not seed. Retry.");
    } finally {
      setLoading(false);
    }
  }
  async function ask(event?: React.FormEvent) {
    event?.preventDefault();
    if (!data) return;
    setAsking(true);
    setAskError("");
    setResult(null);
    const id = data.project.id;
    try {
      const context = retrieve(data, question);
      const explanation: Explanation = demo
        ? { answer: demoAnswer(context), context, source: "local" }
        : await request<Explanation>(`projects/${id}/ask`, "POST", {
            question,
          });
      if (activeProjectRef.current === id) {
        setResult(explanation);
        setPanel(true);
        setPanelTab("answer");
        setPathPlaying(true);
      }
    } catch (e) {
      if (activeProjectRef.current === id)
        setAskError(
          e instanceof Error ? e.message : "Could not explain. Retry.",
        );
    } finally {
      setAsking(false);
    }
  }
  const edgesHighlighted = result ? result.answer.supportingEdgeIds : [];
  const nav = (
    <>
      <div className="project-control">
        <label className="small-label" htmlFor="project-select">
          PROJECT
        </label>
        <select
          id="project-select"
          value={selectedProjectId}
          onChange={(e) => {
            updateUrl({ project: e.target.value, record: null });
            setMenu(false);
          }}
          disabled={!projects.length}
        >
          {projects.length ? (
            projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))
          ) : (
            <option>No projects yet</option>
          )}
        </select>
        <button
          className="icon-button"
          aria-label="Create project"
          onClick={() => setModal({ type: "project" })}
        >
          <Plus aria-hidden="true" size={18} />
        </button>
      </div>
      <nav aria-label="Workspace navigation">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              href={`/app?${new URLSearchParams({ ...Object.fromEntries(params), tab: item.id })}`}
              key={item.id}
              className={`nav-item ${tab === item.id ? "active" : ""}`}
              aria-current={tab === item.id ? "page" : undefined}
              onClick={() => setMenu(false)}
            >
              <Icon size={18} strokeWidth={1.6} aria-hidden="true" />
              {item.label}
              {tab === item.id && <span className="nav-active-dot" />}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-note">
        <GitBranch size={19} aria-hidden="true" />
        <strong>Leave a trail.</strong>
        <p>The next developer might be you.</p>
        <button className="text-button" onClick={seed} disabled={loading}>
          Create sample project <ArrowUpRight size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="sidebar-bottom">
        <span className="avatar">
          {demo ? "D" : (user?.email?.[0] || "U").toUpperCase()}
        </span>
        <div>
          <strong>
            {demo ? "Demo workspace" : user?.displayName || "Your workspace"}
          </strong>
          <small>{demo ? "Stored in this browser" : user?.email}</small>
        </div>
        <button
          className="icon-button"
          aria-label={demo ? "Leave demo" : "Sign out"}
          onClick={async () => {
            if (!demo) await signOut(clientAuth());
            router.push("/");
          }}
        >
          <LogOut size={17} aria-hidden="true" />
        </button>
      </div>
    </>
  );
  if (!demo && ready && !user)
    return (
      <main id="main" className="auth-page">
        <section className="auth-card">
          <Brand />
          <h1>Your project, connected.</h1>
          <p>Sign in to access persistent project memory.</p>
          <Link className="button primary" href="/auth">
            Sign in <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link className="button secondary" href="/app?mode=demo">
            Explore local demo
          </Link>
        </section>
      </main>
    );
  return (
    <div className={`workspace ${panel ? "panel-open" : ""}`}>
      <aside className="sidebar">
        <Link href="/" aria-label="TraceReason home">
          <Brand compact />
        </Link>
        {nav}
      </aside>
      <div className="workspace-body">
        <header className="workspace-header">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMenu(true)}
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <div className="breadcrumb">
            <span>{data?.project.name || "Workspace"}</span>
            <ChevronRight size={13} aria-hidden="true" />
            <strong>{navigation.find((n) => n.id === tab)?.label}</strong>
          </div>
          <div className="header-actions">
            <span className="mode-badge">
              <span className="status-dot" />
              {demo ? "LOCAL DEMO" : "PROJECT MEMORY"}
            </span>
            <button
              className="icon-button"
              aria-label={
                panel ? "Hide contextual panel" : "Show contextual panel"
              }
              onClick={() => setPanel(!panel)}
            >
              {panel ? (
                <PanelRightClose size={18} aria-hidden="true" />
              ) : (
                <PanelRightOpen size={18} aria-hidden="true" />
              )}
            </button>
          </div>
        </header>
        {(demo || data?.project.synthetic) && (
          <div
            className="demo-banner"
            role="region"
            aria-label="Demo mode disclosure"
          >
            <span>
              {demo
                ? "Synthetic demo data · Saved in this browser · Scripted explanations"
                : "Synthetic sample project · Saved in your Neo4j project memory"}
            </span>
            <Link href="/auth">
              Connect your project <ArrowUpRight size={13} aria-hidden="true" />
            </Link>
          </div>
        )}
        <div className="workspace-content">
          <main
            id="main"
            className="main-workspace"
            inert={compact && panel}
            aria-hidden={compact && panel}
          >
            <div className="workspace-title">
              <div>
                <div className="eyebrow">
                  {tab === "graph"
                    ? "THE BIGGER PICTURE"
                    : tab === "debug"
                      ? "CHANGE IMPACT DETECTIVE"
                      : "CONNECTED PROJECT MEMORY"}
                </div>
                <h1>
                  {tab === "graph"
                    ? "Follow the reasoning."
                    : tab === "memory"
                      ? "Nothing gets forgotten."
                      : tab === "debug"
                        ? "Start with a better question."
                        : tab === "overview"
                          ? "Your project’s living history."
                          : "Make this workspace yours."}
                </h1>
                <p>
                  {tab === "graph"
                    ? "Decisions, dependencies, and the evidence in between."
                    : tab === "memory"
                      ? "Capture what happened. Keep the context that matters."
                      : tab === "debug"
                        ? "Trace a possible connection. Check it against the evidence."
                        : tab === "overview"
                          ? "A clear trail from the original why to the latest fix."
                          : "Project settings, service configuration, and demo controls."}
                </p>
              </div>
              {data && tab !== "settings" && (
                <button
                  className="button primary add-record"
                  onClick={() => setModal({ type: "record" })}
                >
                  <Plus size={16} aria-hidden="true" /> Add memory
                </button>
              )}
            </div>
            {(error || askError) && (
              <div className="error-banner" role="alert">
                <span>{error || askError}</span>
                <button
                  className="text-button"
                  onClick={() => (error ? setReload((v) => v + 1) : void ask())}
                  disabled={asking}
                >
                  {askError && !error ? "Retry explanation" : "Retry"}
                </button>
              </div>
            )}
            <div className="sr-only" aria-live="polite">
              {notice}
            </div>
            {notice && (
              <div className="toast" role="status">
                <Check size={15} aria-hidden="true" />
                {notice}
                <button
                  className="icon-button"
                  aria-label="Dismiss notification"
                  onClick={() => setNotice("")}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            )}
            {loading ? (
              <div className="loading-block">
                <LoaderCircle className="spin" aria-hidden="true" /> Loading
                project memory…
              </div>
            ) : !data && tab !== "settings" ? (
              <div className="empty-state">
                <Network size={38} aria-hidden="true" />
                <h2>A project is the first connection.</h2>
                <p>
                  Create a project to start capturing decisions, or explore a
                  synthetic sample.
                </p>
                <div className="empty-actions">
                  <button
                    className="button primary"
                    onClick={() => setModal({ type: "project" })}
                  >
                    Create project
                  </button>
                  <button className="button secondary" onClick={seed}>
                    Create sample project
                  </button>
                </div>
              </div>
            ) : null}
            {data && !loading && (tab === "graph" || tab === "memory") && (
              <>
                <div className="memory-toolbar">
                  <div className="search-field">
                    <Search size={16} aria-hidden="true" />
                    <input
                      aria-label="Search memory"
                      name="search"
                      type="search"
                      autoComplete="off"
                      value={query}
                      onChange={(e) => updateUrl({ q: e.target.value || null })}
                      placeholder="Search your project’s memory…"
                    />
                    <kbd>/</kbd>
                  </div>
                  <button
                    className="button secondary small"
                    onClick={() => setModal({ type: "relationship" })}
                  >
                    <Link2 size={15} aria-hidden="true" /> Connect records
                  </button>
                </div>
                <div
                  className="filter-bar"
                  role="group"
                  aria-label="Record type filters"
                >
                  {["all", ...kinds].map((kind) => (
                    <button
                      key={kind}
                      aria-pressed={filter === kind}
                      className={filter === kind ? "active" : ""}
                      onClick={() =>
                        updateUrl({ type: kind === "all" ? null : kind })
                      }
                    >
                      {kind === "all" ? "All records" : kind}
                      <span>
                        {kind === "all"
                          ? data.records.length
                          : data.records.filter((r) => r.kind === kind).length}
                      </span>
                    </button>
                  ))}
                </div>
                {tab === "graph" ? (
                  <div className="graph-shell">
                    <div className="graph-topline">
                      <span>
                        <span className="status-dot" /> PROJECT CONNECTIONS
                      </span>
                      <span>
                        {visible.length} records ·{" "}
                        {
                          data.relationships.filter(
                            (e) =>
                              visible.some((r) => r.id === e.source) &&
                              visible.some((r) => r.id === e.target),
                          ).length
                        }{" "}
                        connections
                      </span>
                    </div>
                    {visible.length ? (
                      <Graph
                        key={data.project.id}
                        data={data}
                        visibleIds={visible.map((r) => r.id)}
                        selectedId={selected?.id || ""}
                        onSelect={selectGraphNode}
                        onOpen={select}
                        highlightedEdges={edgesHighlighted}
                        animatePaths={pathPlaying}
                      />
                    ) : (
                      <div className="empty-state">
                        <Search aria-hidden="true" />
                        <h2>No matching records.</h2>
                        <p>Clear the search or add your first memory.</p>
                        <button
                          className="button secondary"
                          onClick={() => updateUrl({ q: null, type: null })}
                        >
                          Clear filters
                        </button>
                      </div>
                    )}
                    <div className="graph-footer">
                      <span>Double-click a record or press Enter to see its story.</span>
                      {selected && (
                        <button
                          className="text-button"
                          onClick={() => select(selected.id)}
                        >
                          Open selected record
                        </button>
                      )}
                      {result ? (
                        <button
                          className="text-button"
                          onClick={() => setPathPlaying(!pathPlaying)}
                        >
                          {pathPlaying ? (
                            <Pause size={13} aria-hidden="true" />
                          ) : (
                            <Play size={13} aria-hidden="true" />
                          )}
                          {pathPlaying
                            ? "Pause path animation"
                            : "Animate supporting path"}
                        </button>
                      ) : (
                        <span>Connections show context, not causation.</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="record-list">
                    {visible.length ? (
                      visible.map((r) => {
                        const Icon = icons[r.kind];
                        return (
                          <button
                            className={`memory-row ${r.id === selected?.id ? "selected" : ""}`}
                            key={r.id}
                            onClick={() => select(r.id)}
                          >
                            <span
                              className={`row-icon kind-${r.kind.toLowerCase()}`}
                            >
                              <Icon
                                size={18}
                                strokeWidth={1.6}
                                aria-hidden="true"
                              />
                            </span>
                            <span className="row-copy">
                              <small>{r.kind}</small>
                              <strong>{label(r)}</strong>
                              <span>
                                {r.fields.description ||
                                  r.fields.excerpt ||
                                  r.fields.symptoms ||
                                  r.fields.text}
                              </span>
                            </span>
                            <span className="tag">
                              {r.fields.status ||
                                r.fields.verificationStatus ||
                                r.fields.type ||
                                r.fields.version ||
                                "record"}
                            </span>
                            <ChevronRight size={16} aria-hidden="true" />
                          </button>
                        );
                      })
                    ) : (
                      <div className="empty-state">
                        <Library aria-hidden="true" />
                        <h2>No records here yet.</h2>
                        <button
                          className="button secondary"
                          onClick={() => setModal({ type: "record" })}
                        >
                          Add your first record
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <div className="detective-prompt">
                  <span className="detective-icon">
                    <ScanLine size={23} strokeWidth={1.5} aria-hidden="true" />
                  </span>
                  <div>
                    <strong>Every error has a history.</strong>
                    <p>Find out which past changes are worth investigating.</p>
                  </div>
                  <Link
                    href={`/app?${new URLSearchParams({ ...Object.fromEntries(params), tab: "debug" })}`}
                    className="text-button"
                  >
                    Ask TraceReason{" "}
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </>
            )}
            {data && !loading && tab === "overview" && (
              <div className="overview-content">
                <section className="overview-intro">
                  <span className="project-symbol">
                    <Box size={28} aria-hidden="true" />
                  </span>
                  <h2>{data.project.name}</h2>
                  <p>
                    {data.project.description ||
                      "Add a project description in Settings."}
                  </p>
                  {data.project.synthetic && (
                    <span className="tag">SYNTHETIC DEMO PROJECT</span>
                  )}
                </section>
                <div className="overview-counts">
                  {(["Decision", "Bug", "Fix", "Evidence"] as Kind[]).map(
                    (k) => (
                      <Link
                        key={k}
                        href={`/app?${new URLSearchParams({ ...Object.fromEntries(params), tab: "memory", type: k })}`}
                      >
                        <span>
                          {data.records.filter((r) => r.kind === k).length}
                        </span>
                        <small>
                          {k} records{" "}
                          <ArrowUpRight size={13} aria-hidden="true" />
                        </small>
                      </Link>
                    ),
                  )}
                </div>
                <section className="history">
                  <h2>Memory History</h2>
                  <p className="muted">
                    Latest updates to the current records.
                  </p>
                  {data.records
                    .slice()
                    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                    .slice(0, 12)
                    .map((r) => (
                      <button
                        className="history-item"
                        key={r.id}
                        onClick={() => select(r.id)}
                      >
                        <span className="history-dot" />
                        <div>
                          <small>{r.kind}</small>
                          <strong>{label(r)}</strong>
                        </div>
                        <time dateTime={r.updatedAt}>
                          {new Intl.DateTimeFormat(undefined, {
                            month: "short",
                            day: "numeric",
                          }).format(new Date(r.updatedAt))}
                        </time>
                        <ChevronRight size={14} aria-hidden="true" />
                      </button>
                    ))}
                  {!data.records.length && (
                    <p className="muted">
                      Add your first record to start the timeline.
                    </p>
                  )}
                </section>
              </div>
            )}
            {data && !loading && tab === "debug" && (
              <div className="debug-content">
                <section className="question-card">
                  <div className="eyebrow">
                    <ScanLine size={15} aria-hidden="true" /> CHANGE IMPACT
                    DETECTIVE
                  </div>
                  <h2>
                    Connect the dots
                    <br />
                    before you change the code.
                  </h2>
                  <p>
                    Ask about a decision, describe an error, or trace a change.
                    TraceReason searches this project and follows its
                    connections.
                  </p>
                  <form onSubmit={ask}>
                    <label htmlFor="question" className="sr-only">
                      Debugging question
                    </label>
                    <textarea
                      id="question"
                      name="question"
                      autoComplete="off"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      required
                      minLength={5}
                      maxLength={2000}
                      rows={4}
                      placeholder="Why did we change authentication?…"
                    />
                    <div className="question-footer">
                      <span>
                        {demo
                          ? "Deterministic local demo"
                          : "Project-scoped retrieval · Gemini"}
                      </span>
                      <button className="button primary" disabled={asking}>
                        {asking ? (
                          <>
                            <LoaderCircle
                              className="spin"
                              size={16}
                              aria-hidden="true"
                            />
                            Tracing…
                          </>
                        ) : (
                          <>
                            Trace the connection{" "}
                            <ArrowRight size={16} aria-hidden="true" />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </section>
                <button
                  className="sample-question"
                  onClick={() => setQuestion(demoQuestion)}
                >
                  <span className="small-label">TRY THE DEMO QUESTION</span>
                  <span>{demoQuestion}</span>
                  <CornerDownLeft size={17} aria-hidden="true" />
                </button>
                <div className="retrieval-steps">
                  <span>
                    <Search size={16} aria-hidden="true" /> Search records
                  </span>
                  <ChevronRight size={14} aria-hidden="true" />
                  <span>
                    <Network size={16} aria-hidden="true" /> Follow connections
                  </span>
                  <ChevronRight size={14} aria-hidden="true" />
                  <span>
                    <FileCheck2 size={16} aria-hidden="true" /> Check evidence
                  </span>
                </div>
                {result && (
                  <>
                    <div className="supporting-graph">
                      <h2>Supporting Connections</h2>
                      <button
                        className="text-button"
                        onClick={() => setPathPlaying(!pathPlaying)}
                      >
                        {pathPlaying
                          ? "Pause path animation"
                          : "Animate supporting path"}
                      </button>
                      <Graph
                        key={data.project.id}
                        data={data}
                        visibleIds={result.context.records.map((r) => r.id)}
                        selectedId={selected?.id || ""}
                        onSelect={selectGraphNode}
                        onOpen={select}
                        highlightedEdges={edgesHighlighted}
                        animatePaths={pathPlaying}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
            {tab === "settings" && !loading && (
              <div className="settings-content">
                {data && (
                  <section className="settings-section">
                    <h2>Project</h2>
                    <strong>{data.project.name}</strong>
                    <p>{data.project.description}</p>
                    <div className="settings-actions">
                      <button
                        className="button secondary"
                        onClick={() =>
                          setModal({ type: "project", project: data.project })
                        }
                      >
                        <Pencil size={14} aria-hidden="true" /> Edit project
                      </button>
                      <button className="button danger" onClick={removeProject}>
                        <Trash2 size={14} aria-hidden="true" /> Delete project
                      </button>
                    </div>
                  </section>
                )}
                <section className="settings-section">
                  <h2>Service Configuration</h2>
                  <p>
                    Server secrets stay on the server. Change configuration in
                    your local environment file, then restart the app.
                  </p>
                  {[
                    ["Firebase client", firebaseConfigured],
                    ["Firebase Admin", config?.firebaseAdmin],
                    ["Neo4j", config?.neo4j],
                    ["Gemini model & API key", config?.gemini],
                  ].map(([name, configured]) => (
                    <div className="config-row" key={String(name)}>
                      <span>{name}</span>
                      <span className={`tag ${configured ? "configured" : ""}`}>
                        {configured
                          ? "CONFIGURED · NOT A HEALTH CHECK"
                          : config
                            ? "NEEDS CONFIGURATION"
                            : "CHECKING…"}
                      </span>
                    </div>
                  ))}
                  <p className="muted">
                    Configuration presence does not verify a live connection.
                    Missing credentials never cause a silent switch to demo
                    mode.
                  </p>
                </section>
                <section className="settings-section">
                  <h2>{demo ? "Local Demo" : "Synthetic Sample"}</h2>
                  <p>
                    {demo
                      ? "Demo memory lives only in this browser. Explanations are scripted and do not call Gemini or save to Neo4j."
                      : "Create a clearly labelled fictional project in your own account. Each seed action creates a separate sample project."}
                  </p>
                  <div className="settings-actions">
                    <button className="button secondary" onClick={seed}>
                      <FolderPlus size={15} aria-hidden="true" /> Create sample
                      project
                    </button>
                    {demo && (
                      <button
                        className="button danger"
                        onClick={() =>
                          confirm(
                            "Reset Local Demo?",
                            "Remove all local demo projects and restore the original synthetic sample?",
                            async () => {
                              persist([makeDemo()]);
                              setResult(null);
                              updateUrl({ project: null, record: null });
                              setError("");
                              setNotice("Local demo reset.");
                            },
                          )
                        }
                      >
                        <RotateCcw size={15} aria-hidden="true" /> Reset demo
                      </button>
                    )}
                  </div>
                </section>
              </div>
            )}
          </main>
          {panel && compact && (
            <button
              className="context-backdrop"
              aria-label="Dismiss contextual panel"
              tabIndex={-1}
              onClick={() => setPanel(false)}
            />
          )}
          {panel && (
            <section
              ref={panelRef}
              className="context-panel"
              aria-label="Contextual panel"
              role={compact ? "dialog" : "complementary"}
              aria-modal={compact ? true : undefined}
            >
              <div className="context-tabs">
                <button
                  className={panelTab === "record" ? "active" : ""}
                  onClick={() => setPanelTab("record")}
                >
                  Record details
                </button>
                <button
                  className={panelTab === "answer" ? "active" : ""}
                  onClick={() => setPanelTab("answer")}
                >
                  Explanation{result && <span className="status-dot" />}
                </button>
                <button
                  className="icon-button context-close"
                  aria-label="Close contextual panel"
                  onClick={() => setPanel(false)}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
              <div className="context-scroll">
                {panelTab === "answer" ? (
                  result ? (
                    <AnswerView result={result} onSelect={select} />
                  ) : (
                    <div className="context-empty">
                      <ScanLine size={30} aria-hidden="true" />
                      <h2>A little context goes a long way.</h2>
                      <p>
                        Ask a debugging question to retrieve project memory and
                        inspect the evidence behind the answer.
                      </p>
                      <Link
                        className="button secondary"
                        href={`/app?${new URLSearchParams({ ...Object.fromEntries(params), tab: "debug" })}`}
                      >
                        Open debug assistant{" "}
                        <ArrowUpRight size={14} aria-hidden="true" />
                      </Link>
                    </div>
                  )
                ) : selected && data ? (
                  <RecordDetail
                    record={selected}
                    data={data}
                    onSelect={select}
                    onEdit={() =>
                      setModal({ type: "record", record: selected })
                    }
                    onDelete={() => removeRecord(selected)}
                    onRemoveRelationship={removeRelationship}
                  />
                ) : (
                  <div className="context-empty">
                    <Network size={30} aria-hidden="true" />
                    <h2>Select a memory.</h2>
                    <p>
                      Its reasoning, evidence, and connections will appear here.
                    </p>
                  </div>
                )}
              </div>
              <div className="context-foot">
                <span className="status-dot" /> CONTEXT, WITH A SOURCE.
              </div>
            </section>
          )}
        </div>
      </div>
      {menu && (
        <Dialog title="Workspace Navigation" onClose={() => setMenu(false)}>
          <div className="mobile-navigation">{nav}</div>
        </Dialog>
      )}
      {modal?.type === "record" && (
        <RecordEditor
          record={modal.record}
          onSave={(v) => saveRecord(v, modal.record)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "project" && (
        <ProjectEditor
          project={modal.project}
          onSave={(v) => saveProject(v, modal.project)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "relationship" && data && (
        <RelationshipEditor
          records={data.records}
          projectId={data.project.id}
          onSave={saveRelationship}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "confirm" && (
        <Dialog
          title={modal.title}
          onClose={() => {
            if (!confirmBusy) setModal(null);
          }}
        >
          <p>{modal.description}</p>
          <p className="form-error" role="alert">
            {confirmError}
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              disabled={confirmBusy}
              onClick={() => setModal(null)}
            >
              Cancel
            </button>
            <button
              className="button danger"
              disabled={confirmBusy}
              onClick={async () => {
                setConfirmBusy(true);
                try {
                  await modal.action();
                  setModal(null);
                } catch (e) {
                  setConfirmError(
                    e instanceof Error ? e.message : "Could not finish. Retry.",
                  );
                } finally {
                  setConfirmBusy(false);
                }
              }}
            >
              {confirmBusy ? "Working…" : "Confirm deletion"}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
function RecordDetail({
  record,
  data,
  onSelect,
  onEdit,
  onDelete,
  onRemoveRelationship,
}: {
  record: MemoryRecord;
  data: Snapshot;
  onSelect: (id: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onRemoveRelationship: (e: Relationship) => void;
}) {
  const Icon = icons[record.kind];
  const connected = data.relationships.filter(
    (e) => e.source === record.id || e.target === record.id,
  );
  const evidence = connected.filter(
    (e) => e.type === "SUPPORTED_BY" && e.source === record.id,
  );
  const reasons = connected.filter(
    (e) => e.type === "HAS_REASON" && e.source === record.id,
  );
  return (
    <article className="record-detail">
      <div className="detail-type">
        <span>
          <Icon size={16} aria-hidden="true" />
          {record.kind.toUpperCase()}
        </span>
        <div>
          <button
            className="icon-button"
            aria-label="Edit selected record"
            onClick={onEdit}
          >
            <Pencil size={15} aria-hidden="true" />
          </button>
          <button
            className="icon-button"
            aria-label="Delete selected record"
            onClick={onDelete}
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
      <h2>{label(record)}</h2>
      <div className="detail-meta">
        <span className="tag">
          {record.fields.status ||
            record.fields.verificationStatus ||
            record.kind}
        </span>
        {data.project.synthetic && <span className="tag">SYNTHETIC</span>}
      </div>
      {Object.entries(record.fields)
        .filter(
          ([field, value]) =>
            value &&
            ![
              "name",
              "title",
              "status",
              "verificationStatus",
              "alternatives",
              "revisitConditions",
            ].includes(field),
        )
        .map(([field, value]) => (
          <section className="detail-section" key={field}>
            <h3>{niceField(field)}</h3>
            {field === "url" ? (
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="evidence-url"
              >
                Open source <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            ) : field.endsWith("At") ? (
              <time dateTime={value}>
                {new Intl.DateTimeFormat(undefined, {
                  dateStyle: "medium",
                  timeZone: "UTC",
                }).format(new Date(value))}
              </time>
            ) : (
              <p className={field === "errorMessage" ? "code-excerpt" : ""}>
                {value}
              </p>
            )}
          </section>
        ))}
      {record.kind === "Decision" && (
        <div className="decision-memory">
          <h3>
            <GitBranch size={15} aria-hidden="true" /> Decision Memory
          </h3>
          {reasons.map((e) => {
            const reason = data.records.find((r) => r.id === e.target);
            return reason ? (
              <div key={e.id}>
                <span className="small-label">THE REASON</span>
                <p>{reason.fields.text}</p>
              </div>
            ) : null;
          })}
          <span className="small-label">ALTERNATIVES CONSIDERED</span>
          <p>{record.fields.alternatives || "No alternatives recorded yet."}</p>
          <span className="small-label">WHEN TO REVISIT</span>
          <p>
            {record.fields.revisitConditions ||
              "No revisit conditions recorded yet."}
          </p>
        </div>
      )}
      <section className="detail-section">
        <h3>
          Supporting Evidence <span>{evidence.length}</span>
        </h3>
        {evidence.map((e) => {
          const r = data.records.find((r) => r.id === e.target);
          return r ? (
            <button
              className="evidence-card"
              key={e.id}
              onClick={() => onSelect(r.id)}
            >
              <FileText size={16} aria-hidden="true" />
              <span>
                <strong>{label(r)}</strong>
                <small>{r.fields.excerpt}</small>
              </span>
              <ArrowUpRight size={14} aria-hidden="true" />
            </button>
          ) : null;
        })}
        {!evidence.length && (
          <p className="muted">No supporting evidence linked.</p>
        )}
      </section>
      <section className="detail-section">
        <h3>
          Connections <span>{connected.length}</span>
        </h3>
        {connected.map((e) => {
          const other = data.records.find(
            (r) => r.id === (e.source === record.id ? e.target : e.source),
          );
          return other ? (
            <div className="connection-row" key={e.id}>
              <button onClick={() => onSelect(other.id)}>
                <span>
                  {e.source === record.id ? "→" : "←"}{" "}
                  {e.type.toLowerCase().replaceAll("_", " ")}
                </span>
                <strong>{label(other)}</strong>
              </button>
              <button
                className="icon-button"
                aria-label={`Delete ${e.type.toLowerCase().replaceAll("_", " ")} relationship`}
                onClick={() => onRemoveRelationship(e)}
              >
                <X size={13} aria-hidden="true" />
              </button>
            </div>
          ) : null;
        })}
      </section>
      <div className="record-id">
        <span className="small-label">STABLE RECORD ID</span>
        <code>{record.id}</code>
      </div>
    </article>
  );
}
