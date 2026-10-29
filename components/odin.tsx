"use client";
import { useEffect, useState, lazy, Suspense } from "react";
import {
  Eye,
  Camera,
  Radio,
  Activity,
  ChartNoAxesCombined,
  Workflow,
  Plug,
  MessagesSquare,
  FileText,
  ScanFace,
  Settings,
  ChevronDown,
  ChevronRight,
  Search,
  Bell,
  Command,
  ArrowUpRight,
  Menu,
  X,
  CheckCircle2,
  TriangleAlert,
  ArrowRight,
  ShieldCheck,
  PanelLeftClose,
  Sparkles,
} from "lucide-react";
import { OdinContext, useOdinState, Page } from "./odin-context";
import { Button, Modal, Empty, Spinner } from "./common";
import { Dashboard, ActivityPage, CameraForm, EventDetail } from "./dashboard";
import { Monitor } from "./monitor";
import { WorkflowsPage } from "./workflows";
const AnalyticsPage = lazy(() => import("./analytics"));
import {
  TriggersPage,
  IntegrationsPage,
  ChatPage,
  ReportsPage,
  FacesPage,
  SettingsPage,
} from "./views";
const navs: { label: string; page: Page; icon: any; group: string }[] = [
  { label: "Cameras", page: "cameras", icon: Camera, group: "MONITOR" },
  { label: "Live viewer", page: "live", icon: Radio, group: "MONITOR" },
  { label: "Activity", page: "activity", icon: Activity, group: "MONITOR" },
  {
    label: "Analytics",
    page: "analytics",
    icon: ChartNoAxesCombined,
    group: "MONITOR",
  },
  { label: "Triggers", page: "triggers", icon: Sparkles, group: "AUTOMATE" },
  { label: "Workflows", page: "workflows", icon: Workflow, group: "AUTOMATE" },
  {
    label: "Integrations",
    page: "integrations",
    icon: Plug,
    group: "AUTOMATE",
  },
  {
    label: "Camera chat",
    page: "chat",
    icon: MessagesSquare,
    group: "INTELLIGENCE",
  },
  { label: "Reports", page: "reports", icon: FileText, group: "INTELLIGENCE" },
  {
    label: "Face recognition",
    page: "faces",
    icon: ScanFace,
    group: "INTELLIGENCE",
  },
];
export default function Odin() {
  const { context, toast } = useOdinState();
  const { data, loading, error, page, selectedId, navigate, refresh } = context;
  const [mobile, setMobile] = useState(false),
    [search, setSearch] = useState(false),
    [query, setQuery] = useState(""),
    [addCamera, setAddCamera] = useState(false),
    [eventId, setEventId] = useState("");
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearch((v) => !v);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const go = (p: Page, id = "") => {
    navigate(p, id);
    setMobile(false);
    setSearch(false);
  };
  const current = navs.find((n) => n.page === page);
  const camera = data?.cameras.find((c) => c.id === selectedId);
  const unreviewed = data?.events.filter((e) => !e.acknowledged).length || 0;
  return (
    <OdinContext.Provider value={context}>
      <div className="app-shell">
        <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
          <a href="#cameras" className="brand" onClick={() => go("cameras")}>
            <span className="brand-mark">
              <Eye size={25} strokeWidth={2.4} />
            </span>
            <span>
              odin<span className="brand-period">.</span>
            </span>
            <span className="brand-tag">VISION OS</span>
          </a>
          <button className="workspace-switch" onClick={() => go("settings")}>
            <span className="workspace-avatar">O</span>
            <span>
              <strong>
                {data?.settings.workspaceName || "Odin workspace"}
              </strong>
              <small>Personal workspace</small>
            </span>
            <ChevronDown size={14} />
          </button>
          <nav aria-label="Main navigation">
            {["MONITOR", "AUTOMATE", "INTELLIGENCE"].map((group) => (
              <div className="nav-group" key={group}>
                <div className="nav-label">{group}</div>
                {navs
                  .filter((n) => n.group === group)
                  .map((n) => (
                    <button
                      key={n.page}
                      onClick={() => go(n.page)}
                      className={`nav-item ${page === n.page ? "active" : ""}`}
                    >
                      <n.icon size={18} />
                      <span>{n.label}</span>
                      {n.page === "activity" && unreviewed > 0 && (
                        <span className="nav-count">{unreviewed}</span>
                      )}
                      {n.page === "chat" && (
                        <Sparkles className="nav-spark" size={13} />
                      )}
                    </button>
                  ))}
              </div>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="system-card">
              <div>
                <span className="status-dot" />
                All eyes on your world
                <ShieldCheck size={15} />
              </div>
              <p>Your workspace is private.</p>
              <span>
                ODIN ENGINE <span>v1.0</span>
              </span>
            </div>
            <button
              className={`nav-item ${page === "settings" ? "active" : ""}`}
              onClick={() => go("settings")}
            >
              <Settings size={18} />
              <span>Settings</span>
            </button>
            <div className="profile">
              <span className="avatar">
                {data?.user.name?.charAt(0).toUpperCase() || "A"}
              </span>
              <span>
                <strong>
                  {data?.user.name?.split("@")[0] || "My workspace"}
                </strong>
                <small>Workspace owner</small>
              </span>
              <a
                href="/signout-with-chatgpt?return_to=/"
                target="_top"
                title="Sign out"
              >
                <ArrowUpRight size={16} />
              </a>
            </div>
          </div>
        </aside>
        {mobile && (
          <button
            className="mobile-scrim"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          />
        )}
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="icon-btn mobile-menu"
                aria-label="Open navigation"
                onClick={() => setMobile(true)}
              >
                <Menu size={20} />
              </button>
              <span>Workspace</span>
              <ChevronRight size={13} />
              <strong>{current?.label || "Settings"}</strong>
              {camera && (
                <>
                  <ChevronRight size={13} />
                  <span>{camera.name}</span>
                </>
              )}
            </div>
            <div className="top-actions">
              <button className="global-search" onClick={() => setSearch(true)}>
                <Search size={15} />
                <span>Search anything…</span>
                <kbd>⌘ K</kbd>
              </button>
              <span className="top-divider" />
              <button
                className="icon-btn notification"
                aria-label="View notifications"
                onClick={() => go("activity")}
              >
                <Bell size={18} />
                {unreviewed > 0 && <i />}
              </button>
              <button
                className="top-avatar"
                onClick={() => go("settings")}
                aria-label="Open account"
              >
                {data?.user.name?.charAt(0).toUpperCase() || "A"}
              </button>
            </div>
          </header>
          <main className="content">
            {loading ? (
              <div className="boot">
                <span className="brand-mark">
                  <Eye size={30} />
                </span>
                <Spinner text="Opening your workspace" />
              </div>
            ) : error ? (
              <div className="boot">
                <TriangleAlert size={32} />
                <h2>{error}</h2>
                <p>Sign in to open your private monitoring workspace.</p>
                <a
                  className="btn primary"
                  href="/signin-with-chatgpt?return_to=/"
                  target="_top"
                >
                  Sign in to Odin <ArrowRight size={16} />
                </a>
                <Button onClick={() => void refresh()}>Retry connection</Button>
              </div>
            ) : data ? (
              <>
                {page === "cameras" ? (
                  camera ? (
                    <Monitor
                      camera={camera}
                      onBack={() => go("cameras")}
                      onEvent={setEventId}
                    />
                  ) : (
                    <Dashboard
                      onAdd={() => setAddCamera(true)}
                      onCamera={(id) => go("cameras", id)}
                      onEvent={setEventId}
                    />
                  )
                ) : page === "live" ? (
                  <Monitor live onEvent={setEventId} />
                ) : page === "activity" ? (
                  <ActivityPage onEvent={setEventId} />
                ) : page === "triggers" ? (
                  <TriggersPage />
                ) : page === "workflows" ? (
                  <WorkflowsPage />
                ) : page === "analytics" ? (
                  <Suspense fallback={<Spinner text="Loading analytics…" />}>
                    <AnalyticsPage />
                  </Suspense>
                ) : page === "integrations" ? (
                  <IntegrationsPage />
                ) : page === "chat" ? (
                  <ChatPage />
                ) : page === "reports" ? (
                  <ReportsPage />
                ) : page === "faces" ? (
                  <FacesPage />
                ) : (
                  <SettingsPage />
                )}
              </>
            ) : null}
          </main>
          <footer className="app-footer">
            <span>
              <span className="status-dot" />
              Odin visual intelligence
            </span>
            <span>Observe. Understand. Act.</span>
            <span>
              Built for a world in motion <ArrowUpRight size={12} />
            </span>
          </footer>
        </div>
        {toast && (
          <div className={`toast ${toast.type}`} role="status">
            {toast.type === "error" ? (
              <TriangleAlert size={18} />
            ) : (
              <CheckCircle2 size={18} />
            )}
            <span>{toast.text}</span>
          </div>
        )}
        {addCamera && <CameraForm onClose={() => setAddCamera(false)} />}
        {eventId && data && (
          <EventDetail
            event={data.events.find((e) => e.id === eventId)!}
            onClose={() => setEventId("")}
          />
        )}
        {search && (
          <Modal title="Search your workspace" onClose={() => setSearch(false)}>
            <div className="search-input">
              <Search size={18} />
              <input
                autoFocus
                placeholder="Cameras, workflows, events…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd>ESC</kbd>
            </div>
            <div className="search-results">
              {!query ? (
                <p className="muted">
                  Type to find a camera, workflow, or event.
                </p>
              ) : (
                <>
                  {data?.cameras
                    .filter((c) =>
                      `${c.name} ${c.location}`
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .map((c) => (
                      <button key={c.id} onClick={() => go("cameras", c.id)}>
                        <Camera size={17} />
                        <span>
                          {c.name}
                          <small>{c.location}</small>
                        </span>
                        <ChevronRight size={15} />
                      </button>
                    ))}
                  {data?.workflows
                    .filter((f) =>
                      f.name.toLowerCase().includes(query.toLowerCase()),
                    )
                    .map((f) => (
                      <button key={f.id} onClick={() => go("workflows", f.id)}>
                        <Workflow size={17} />
                        <span>
                          {f.name}
                          <small>Workflow</small>
                        </span>
                        <ChevronRight size={15} />
                      </button>
                    ))}
                  {data?.events
                    .filter((e) =>
                      e.title.toLowerCase().includes(query.toLowerCase()),
                    )
                    .slice(0, 5)
                    .map((e) => (
                      <button
                        key={e.id}
                        onClick={() => {
                          setSearch(false);
                          setEventId(e.id);
                        }}
                      >
                        <Activity size={17} />
                        <span>
                          {e.title}
                          <small>Event</small>
                        </span>
                        <ChevronRight size={15} />
                      </button>
                    ))}
                </>
              )}
            </div>
          </Modal>
        )}
      </div>
    </OdinContext.Provider>
  );
}
