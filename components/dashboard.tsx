"use client";
import { useMemo, useState } from "react";
import {
  Camera as CameraIcon,
  Plus,
  ArrowUpRight,
  ArrowRight,
  Search,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronRight,
  Radio,
  Workflow,
  Activity,
  ShieldCheck,
  Signal,
  MoreHorizontal,
  Maximize,
  Play,
  Pause,
  MapPin,
  TriangleAlert,
  Check,
  CheckCheck,
  Download,
  SlidersHorizontal,
  Trash2,
  Pencil,
  Video,
  Upload,
  Link as LinkIcon,
  Webcam,
  AlertCircle,
  Clock,
  ScanLine,
  Eye,
} from "lucide-react";
import { useOdin } from "./odin-context";
import {
  Button,
  PageHeading,
  Badge,
  EventRow,
  Empty,
  Modal,
  Field,
  Spinner,
  time,
  date,
  downloadJson,
  relative,
} from "./common";
import type { Camera, Event } from "@/lib/types";
export function Dashboard({
  onAdd,
  onCamera,
  onEvent,
}: {
  onAdd: () => void;
  onCamera: (id: string) => void;
  onEvent: (id: string) => void;
}) {
  const { data, navigate, api, refresh, notify } = useOdin();
  const d = data!;
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [layout, setLayout] = useState("grid"),
    [category, setCategory] = useState("all");
  const online = d.cameras.filter(
    (c) => c.status === "online" && c.enabled,
  ).length;
  const active = d.workflows.filter((f) => f.enabled).length;
  const today = new Date().setHours(0, 0, 0, 0);
  const todayEvents = d.events.filter((e) => e.timestamp >= today);
  const filtered = d.cameras.filter(
    (c) =>
      (filter === "all" ||
        (filter === "online" && c.status === "online" && c.enabled) ||
        (filter === "offline" && (c.status === "offline" || !c.enabled))) &&
      (category === "all" || c.category === category) &&
      `${c.name} ${c.location}`.toLowerCase().includes(query.toLowerCase()),
  );
  const events = [...d.events].sort((a, b) => b.timestamp - a.timestamp);
  const stats = [
    {
      label: "Total cameras",
      value: d.cameras.length,
      icon: CameraIcon,
      note: `${online} online`,
      color: "lime",
      trend: "Connected sources",
    },
    {
      label: "Events today",
      value: todayEvents.length,
      icon: Activity,
      note: `${todayEvents.filter((e) => !e.acknowledged).length} to review`,
      color: "blue",
      trend: "Across all cameras",
    },
    {
      label: "Active workflows",
      value: active,
      icon: Workflow,
      note: `${d.workflows.length} configured`,
      color: "purple",
      trend: "Intelligence in action",
    },
    {
      label: "System health",
      value: d.cameras.length
        ? `${Math.round((online / d.cameras.length) * 100)}%`
        : "—",
      icon: ShieldCheck,
      note:
        online === d.cameras.length
          ? "All online"
          : `${d.cameras.length - online} offline`,
      color: "orange",
      trend: "Camera availability",
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="YOUR WORLD, IN VIEW"
        title="Camera overview"
        description="A little more awareness. A lot more peace of mind."
      >
        <span className="operational">
          <span className="status-dot" />
          System operational
        </span>
        <Button variant="primary" onClick={onAdd}>
          <Plus size={16} />
          Add camera
        </Button>
      </PageHeading>
      <div className="stats-grid">
        {stats.map((s, i) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-top">
              <span>{s.label}</span>
              <s.icon size={17} className={`text-${s.color}`} />
            </div>
            <div className="stat-value">
              {s.value}
              <span className={`stat-note ${s.color}`}>
                <span className="mini-dot" />
                {s.note}
              </span>
            </div>
            <div className="stat-bottom">
              <span>{s.trend}</span>
              <svg className={`sparkline ${s.color}`} viewBox="0 0 100 25">
                <path
                  d={
                    i === 0
                      ? "M0 22L13 22L13 16L28 16L28 20L40 20L40 12L58 12L58 15L73 15L73 6L85 6L85 3L100 3"
                      : i === 1
                        ? "M0 20L10 17L20 21L28 12L35 17L43 10L53 13L64 6L73 11L82 5L90 8L100 2"
                        : i === 2
                          ? "M0 20L20 20L20 15L45 15L45 15L60 15L60 9L80 9L80 4L100 4"
                          : "M0 7L10 7L15 12L20 4L26 7L40 7L44 12L50 3L56 7L80 7L88 3L94 7L100 7"
                  }
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
          </div>
        ))}
      </div>
      <div className="dashboard-columns">
        <section className="camera-section">
          <div className="section-toolbar">
            <div className="tabs">
              <button
                className={filter === "all" ? "selected" : ""}
                onClick={() => setFilter("all")}
              >
                All cameras <span>{d.cameras.length}</span>
              </button>
              <button
                className={filter === "online" ? "selected" : ""}
                onClick={() => setFilter("online")}
              >
                <span className="mini-dot green" />
                Online <span>{online}</span>
              </button>
              <button
                className={filter === "offline" ? "selected" : ""}
                onClick={() => setFilter("offline")}
              >
                Offline <span>{d.cameras.length - online}</span>
              </button>
            </div>
            <div className="view-switch">
              <button
                className={layout === "grid" ? "selected" : ""}
                aria-label="Grid view"
                onClick={() => setLayout("grid")}
              >
                <LayoutGrid size={16} />
              </button>
              <button
                className={layout === "list" ? "selected" : ""}
                aria-label="List view"
                onClick={() => setLayout("list")}
              >
                <List size={17} />
              </button>
            </div>
          </div>
          <div className="filter-toolbar">
            <div className="search-input">
              <Search size={15} />
              <input
                aria-label="Search cameras"
                placeholder="Search cameras…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="select-wrap">
              <SlidersHorizontal size={14} />
              <select
                aria-label="Filter locations"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="all">All categories</option>
                {[...new Set(d.cameras.map((c) => c.category))].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div
            className={`camera-grid ${layout === "list" ? "list-view" : ""}`}
          >
            {filtered.map((camera, i) => {
              const count = d.events.filter(
                (e) => e.cameraId === camera.id,
              ).length;
              const on = camera.status === "online" && camera.enabled;
              return (
                <article
                  className={`camera-card ${!on ? "offline" : ""}`}
                  key={camera.id}
                >
                  <button
                    className="camera-preview"
                    onClick={() => onCamera(camera.id)}
                    aria-label={`Open ${camera.name}`}
                  >
                    <img
                      src={
                        camera.thumbnail || `/images/camera-${(i % 6) + 1}.jpg`
                      }
                      alt={camera.name}
                      onError={(e) => {
                        e.currentTarget.src = "/images/camera-1.jpg";
                      }}
                    />
                    <div className="camera-image-shade" />
                    <div className="feed-top">
                      <span className={`feed-badge ${on ? "" : "off"}`}>
                        <span />
                        {on
                          ? camera.source === "demo"
                            ? "PREVIEW"
                            : "CONNECTED"
                          : "OFFLINE"}
                      </span>
                      <span className="camera-id">
                        {camera.id.startsWith("cam-")
                          ? camera.id.toUpperCase()
                          : `CAM-${String(i + 1).padStart(3, "0")}`}
                      </span>
                    </div>
                    {on && camera.source === "demo" && (
                      <>
                        <div className="sample-watermark">SAMPLE FEED</div>
                        {i < 3 && (
                          <div className={`detection-box box-${i}`}>
                            <span>
                              {i === 0
                                ? "person 97%"
                                : i === 1
                                  ? "person 99%"
                                  : "person 94%"}
                            </span>
                            <i />
                            <i />
                            <i />
                            <i />
                          </div>
                        )}
                      </>
                    )}
                    {!on ? (
                      <div className="offline-message">
                        <Video size={24} />
                        <span>Camera is offline</span>
                      </div>
                    ) : (
                      <span className="preview-open">
                        <Maximize size={18} />
                      </span>
                    )}
                    <div className="feed-bottom">
                      <span>
                        <span className="record-dot" />
                        {camera.source === "demo"
                          ? "DEMO"
                          : camera.source === "webcam"
                            ? "DEVICE"
                            : "VIDEO"}{" "}
                        <span>·</span>{" "}
                        {camera.source === "demo"
                          ? "1920 × 1080"
                          : "Open to monitor"}
                      </span>
                      <Signal size={12} />
                    </div>
                  </button>
                  <div className="camera-info">
                    <button onClick={() => onCamera(camera.id)}>
                      <h3>{camera.name}</h3>
                      <p>
                        <MapPin size={12} />
                        {camera.location}
                      </p>
                    </button>
                    <button
                      className="icon-btn"
                      aria-label={`View ${camera.name} details`}
                      onClick={() => onCamera(camera.id)}
                    >
                      <ChevronRight size={17} />
                    </button>
                  </div>
                  <div className="camera-card-footer">
                    <span>
                      <span className={`status-dot ${on ? "" : "gray"}`} />
                      {on ? "Monitoring enabled" : "Not monitoring"}
                    </span>
                    <span>
                      <Activity size={12} />
                      {count} events
                    </span>
                  </div>
                </article>
              );
            })}
            {!filtered.length && (
              <Empty
                title="No cameras found"
                text="Try another search or add a camera."
                action={
                  <Button onClick={onAdd}>
                    <Plus size={15} />
                    Add camera
                  </Button>
                }
              />
            )}
          </div>
          <div className="camera-grid-caption">
            <span>
              Showing {filtered.length} of {d.cameras.length} cameras
            </span>
            <span>
              <ShieldCheck size={12} />
              Your feeds stay private
            </span>
          </div>
          <div className="intelligence-banner">
            <span className="banner-icon">
              <Workflow size={24} />
            </span>
            <div>
              <h3>Let your cameras do more.</h3>
              <p>Turn what you see into what happens next.</p>
            </div>
            <Button onClick={() => navigate("workflows")}>
              Build a workflow <ArrowUpRight size={15} />
            </Button>
            <div className="banner-decoration">
              <Eye size={100} />
            </div>
          </div>
        </section>
        <aside className="activity-panel">
          <div className="panel-title">
            <h2>
              <span className="pulse-circle" />
              Recent activity
            </h2>
            <Badge tone="lime">
              {events.filter((e) => !e.acknowledged).length} new
            </Badge>
          </div>
          <p className="panel-subtitle">The moments that matter.</p>
          <div className="activity-timeline">
            {events.slice(0, 5).map((e) => (
              <EventRow
                compact
                key={e.id}
                event={e}
                camera={d.cameras.find((c) => c.id === e.cameraId)}
                onClick={() => onEvent(e.id)}
              />
            ))}
          </div>
          <button className="view-all" onClick={() => navigate("activity")}>
            View all activity <ArrowRight size={14} />
          </button>
          <div className="activity-insight">
            <span className="insight-icon">
              <Eye size={19} />
            </span>
            <Badge tone="purple">ODIN INSIGHT</Badge>
            <h3>Awareness starts here.</h3>
            <p>
              Connect your first live camera to turn real-world moments into
              useful insights.
            </p>
            <button onClick={onAdd}>
              Connect a camera <ArrowUpRight size={14} />
            </button>
            <div className="insight-rings">
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="activity-legend">
            <span>
              <i className="critical" />
              Critical
            </span>
            <span>
              <i className="warning" />
              Warning
            </span>
            <span>
              <i className="info" />
              Information
            </span>
          </div>
        </aside>
      </div>
    </>
  );
}
export function CameraForm({
  onClose,
  camera,
}: {
  onClose: () => void;
  camera?: Camera;
}) {
  const { persist, notify } = useOdin();
  const [name, setName] = useState(camera?.name || ""),
    [location, setLocation] = useState(camera?.location || ""),
    [category, setCategory] = useState(camera?.category || "Office"),
    [source, setSource] = useState(camera?.source || "webcam"),
    [url, setUrl] = useState(camera?.url || ""),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      let media = url;
      if (source === "upload" && file) {
        const form = new FormData();
        form.append("file", file);
        const r = await fetch("/api/media", { method: "POST", body: form });
        const v: any = await r.json();
        if (!r.ok) throw new Error(v.error);
        media = v.url;
      }
      if (source === "upload" && !media)
        throw new Error("Choose a video to upload.");
      await persist("cameras", {
        id: camera?.id || crypto.randomUUID(),
        name,
        location,
        category,
        source,
        url: source === "webcam" ? "" : media,
        thumbnail: camera?.thumbnail || "",
        status: "online",
        enabled: true,
        createdAt: camera?.createdAt || Date.now(),
      });
      notify(camera ? "Camera updated" : "Camera added to your workspace");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save camera.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={camera ? "Edit camera" : "A new perspective"}
      subtitle="Connect a camera to your Odin workspace."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Camera name">
            <input
              autoFocus
              required
              maxLength={160}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Main entrance"
            />
          </Field>
          <Field label="Location">
            <input
              value={location}
              maxLength={160}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Headquarters"
            />
          </Field>
        </div>
        <Field label="Category">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {[
              "Office",
              "Warehouse",
              "Retail",
              "Industrial",
              "Outdoor",
              "Home",
              "Healthcare",
              "Other",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
        <Field label="Video source">
          <div className="source-options">
            {[
              { v: "webcam", label: "Webcam", icon: Webcam },
              { v: "upload", label: "Upload video", icon: Upload },
              { v: "url", label: "Stream URL", icon: LinkIcon },
            ].map((s) => (
              <button
                type="button"
                key={s.v}
                className={source === s.v ? "selected" : ""}
                onClick={() => setSource(s.v as Camera["source"])}
              >
                <s.icon size={21} />
                {s.label}
              </button>
            ))}
          </div>
        </Field>
        {source === "url" && (
          <Field
            label="Video URL"
            hint="Public HTTPS MP4 or WebM source with CORS enabled. RTSP cameras need an HLS/MP4 gateway."
          >
            <input
              required
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-camera.example/feed.mp4"
            />
          </Field>
        )}
        {source === "upload" && (
          <Field
            label="Video file"
            hint="MP4, WebM, or Ogg. Maximum 50 MB. Stored privately."
          >
            <input
              type="file"
              accept="video/mp4,video/webm,video/ogg"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </Field>
        )}
        {source === "webcam" && (
          <div className="info-box">
            <Webcam size={19} />
            <p>
              Your browser will ask for camera access when you start monitoring.
              Audio is disabled by default.
            </p>
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? (
              <Spinner text={file ? "Uploading & saving…" : "Saving…"} />
            ) : (
              <>
                <Plus size={15} />
                {camera ? "Save camera" : "Add camera"}
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function EventDetail({
  event,
  onClose,
}: {
  event: Event;
  onClose: () => void;
}) {
  const { data, api, refresh, notify, navigate } = useOdin();
  const [busy, setBusy] = useState(false);
  if (!event) return null;
  const camera = data?.cameras.find((c) => c.id === event.cameraId);
  async function acknowledge() {
    setBusy(true);
    try {
      await api("events", { id: event.id }, "PATCH");
      await refresh();
      notify("Event marked as reviewed");
      onClose();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Event details"
      subtitle={`${camera?.name || "Camera"} · ${date(event.timestamp)} at ${time(event.timestamp)}`}
      onClose={onClose}
    >
      <div className="event-detail">
        <div className="event-detail-badges">
          <Badge tone={event.severity}>{event.severity}</Badge>
          {event.demo && <Badge>Sample event</Badge>}
          <Badge tone={event.acknowledged ? "lime" : "orange"}>
            {event.acknowledged ? "Reviewed" : "Awaiting review"}
          </Badge>
        </div>
        <h3>{event.title}</h3>
        <p>{event.description}</p>
        {event.snapshot && <img src={event.snapshot} alt="Event snapshot" />}
        <div className="detail-grid">
          <div>
            <span>Confidence</span>
            <strong>{Math.round(event.confidence * 100)}%</strong>
          </div>
          <div>
            <span>Detection class</span>
            <strong>{event.type}</strong>
          </div>
          <div>
            <span>Camera</span>
            <strong>{camera?.name || "Removed camera"}</strong>
          </div>
          <div>
            <span>Location</span>
            <strong>{camera?.location || "—"}</strong>
          </div>
        </div>
      </div>
      <div className="modal-actions">
        <Button
          onClick={() => {
            navigate("cameras", event.cameraId);
            onClose();
          }}
        >
          View camera <ArrowUpRight size={15} />
        </Button>
        {!event.acknowledged && (
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => void acknowledge()}
          >
            {busy ? (
              <Spinner text="Updating…" />
            ) : (
              <>
                <CheckCheck size={16} />
                Mark reviewed
              </>
            )}
          </Button>
        )}
      </div>
    </Modal>
  );
}
export function ActivityPage({ onEvent }: { onEvent: (id: string) => void }) {
  const { data, api, refresh, notify } = useOdin();
  const [severity, setSeverity] = useState("all"),
    [camera, setCamera] = useState("all"),
    [query, setQuery] = useState(""),
    [onlyOpen, setOnlyOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const events = [...data!.events]
    .filter(
      (e) =>
        (severity === "all" || e.severity === severity) &&
        (camera === "all" || e.cameraId === camera) &&
        (!onlyOpen || !e.acknowledged) &&
        `${e.title} ${e.description}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => b.timestamp - a.timestamp);
  async function reviewAll() {
    setBusy(true);
    try {
      await Promise.all(
        events
          .filter((e) => !e.acknowledged)
          .map((e) => api("events", { id: e.id }, "PATCH")),
      );
      await refresh();
      notify("Selected events marked as reviewed");
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="NOTHING MISSED"
        title="Activity"
        description="A clear timeline of everything your cameras observe."
      >
        <Button onClick={() => downloadJson("odin-events.json", events)}>
          <Download size={15} />
          Export events
        </Button>
        <Button
          variant="primary"
          disabled={busy || !events.some((e) => !e.acknowledged)}
          onClick={() => void reviewAll()}
        >
          <CheckCheck size={16} />
          {busy ? "Reviewing…" : "Mark all reviewed"}
        </Button>
      </PageHeading>
      <div className="activity-stats">
        {["critical", "warning", "info"].map((s) => (
          <button
            key={s}
            className={severity === s ? "selected" : ""}
            onClick={() => setSeverity(severity === s ? "all" : s)}
          >
            <span className={`event-symbol ${s}`}>
              <Activity size={19} />
            </span>
            <span>
              <strong>
                {data!.events.filter((e) => e.severity === s).length}
              </strong>
              <small>
                {s === "info"
                  ? "Informational"
                  : s.charAt(0).toUpperCase() + s.slice(1)}{" "}
                events
              </small>
            </span>
            <ArrowUpRight size={16} />
          </button>
        ))}
      </div>
      <section className="surface">
        <div className="filter-toolbar">
          <div className="search-input">
            <Search size={16} />
            <input
              placeholder="Search events…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="filter-options">
            <select
              aria-label="Filter camera"
              value={camera}
              onChange={(e) => setCamera(e.target.value)}
            >
              <option value="all">All cameras</option>
              {data!.cameras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              className={`btn ${onlyOpen ? "primary" : "secondary"}`}
              onClick={() => setOnlyOpen((v) => !v)}
            >
              Awaiting review
            </button>
          </div>
        </div>
        <div className="event-list-heading">
          <span>{events.length} events</span>
          <span>Latest first</span>
        </div>
        {events.length ? (
          events.map((e) => (
            <EventRow
              key={e.id}
              event={e}
              camera={data!.cameras.find((c) => c.id === e.cameraId)}
              onClick={() => onEvent(e.id)}
            />
          ))
        ) : (
          <Empty
            icon={CheckCheck}
            title="You're all caught up"
            text="There are no events matching these filters."
          />
        )}
      </section>
    </>
  );
}
