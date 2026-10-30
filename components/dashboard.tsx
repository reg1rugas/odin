"use client";
import { useMemo, useState } from "react";
import { DemoVideo } from "./demo-video";
import { IncidentHistory } from "./incident-history";
import { EventSearch } from "./event-search";
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
  const { data, navigate } = useOdin();
  const [query, setQuery] = useState("");
  const cameras = data!.cameras.filter((c) =>
    `${c.name} ${c.location}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="camera-dashboard">
      <div className="classic-heading">
        <h1>Camera Dashboard</h1>
        <div>
          <button
            className="btn secondary"
            onClick={() => navigate("activity")}
          >
            Search recordings <Search size={14} />
          </button>
          <button
            className="btn secondary"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("odin-monitor-cameras"))
            }
          >
            <Radio size={14} />
            Monitor cameras
          </button>
          <button className="btn primary" onClick={onAdd}>
            <Plus size={15} />
            Add New Camera
          </button>
        </div>
      </div>
      <div className="classic-camera-tools">
        <div className="search-input">
          <Search size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cameras…"
            aria-label="Search cameras"
          />
        </div>
        <span>
          {cameras.length} cameras ·{" "}
          {data!.workflows.filter((f) => f.enabled).length} active workflows
        </span>
      </div>
      <div className="classic-camera-grid">
        {cameras.map((camera) => (
          <article className="classic-camera-card" key={camera.id}>
            <button
              className="classic-camera-title"
              onClick={() => onCamera(camera.id)}
            >
              <CameraIcon size={15} />
              <strong>{camera.name}</strong>
              <ArrowUpRight size={14} />
            </button>
            <p>{camera.location}</p>
            <button
              className="classic-camera-feed"
              onClick={() => onCamera(camera.id)}
              aria-label={`Open ${camera.name}`}
            >
              {camera.source === "demo" ? (
                <DemoVideo camera={camera} />
              ) : camera.url && camera.source !== "webcam" ? (
                <video
                  src={camera.url}
                  poster={camera.thumbnail}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                />
              ) : camera.thumbnail ? (
                <img src={camera.thumbnail} alt={camera.name} />
              ) : (
                <span className="camera-placeholder">
                  <Webcam size={35} />
                  Open camera to start monitoring
                </span>
              )}
              <span className="classic-feed-tag">
                {camera.source === "demo"
                  ? "DEMO FOOTAGE"
                  : camera.source === "webcam"
                    ? "DEVICE CAMERA"
                    : "VIDEO SOURCE"}
              </span>
              <span className="classic-camera-play">
                <Play size={28} />
              </span>
            </button>
            <div className="classic-camera-status">
              <span className="status-dot" />
              {camera.source === "demo"
                ? "Recorded footage · labeled detections"
                : "Ready to monitor"}
              <button onClick={() => onCamera(camera.id)}>
                Open <ChevronRight size={13} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {!cameras.length && (
        <Empty
          title="No cameras found"
          text="Add a webcam, video file, or video URL to start."
          action={
            <Button onClick={onAdd}>
              <Plus size={15} />
              Add New Camera
            </Button>
          }
        />
      )}
    </div>
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
  const alerts = (data?.executions || []).filter(ex => ex.eventId === event.id).sort((a,b) => b.timestamp-a.timestamp);
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
        {!!alerts.length && <section className="analysis-summary" aria-label="Workflow alerts for this event">
          <strong>Workflow alerts ({alerts.length})</strong>
          {alerts.slice(0,20).map(alert => <div key={alert.id} style={{marginTop: 8}}>
            <strong>{alert.eventTitle}</strong>{" "}<Badge tone={alert.status === "failed" ? "critical" : alert.status === "success" ? "lime" : "orange"}>{alert.status}</Badge>
            <p>{alert.workflowName} · {time(alert.timestamp)}{alert.sourceTime !== undefined ? ` · video ${alert.sourceTime.toFixed(1)}s` : ""}</p>
            {alert.results.map(result => <small key={result.nodeId} style={{display: "block"}}>{result.action}: {result.status} · {result.message}</small>)}
          </div>)}
        </section>}
        {event.trackId && <p>Track ID: {event.trackId}. Tracks apply within this camera and capture session.</p>}
        {event.snapshot && <img src={event.snapshot} alt="Event snapshot" />}
        {!!event.trail?.length && (
          <div>
            <p>Recent movement · {event.trail.length} sampled positions</p>
            <svg viewBox="0 0 100 100" role="img" aria-label="Recent movement trail within the camera frame" style={{ width: "100%", maxHeight: 220, background: "#f3f4f6" }}>
              <polyline points={event.trail.map((p) => `${p.x * 100},${p.y * 100}`).join(" ")} fill="none" stroke="#c00074" strokeWidth="1" />
              <circle cx={event.trail.at(-1)!.x * 100} cy={event.trail.at(-1)!.y * 100} r="2" fill="#c00074" />
            </svg>
          </div>
        )}
        <div className="detail-grid">
          {event.trackId && <>
            <div><span>First seen</span><strong>{date(event.firstSeen ?? event.timestamp)} {time(event.firstSeen ?? event.timestamp)}</strong></div>
            <div><span>Last recorded sighting</span><strong>{date(event.lastSeen ?? event.timestamp)} {time(event.lastSeen ?? event.timestamp)}</strong></div>
            {event.movement && <div><span>Recent movement in frame</span><strong>{event.movement.direction} · {event.movement.framePercentPerSecond.toFixed(1)}% frame/s</strong></div>}
            <div><span>Observations</span><strong>{event.observationCount || 1}</strong></div>
            {event.position && <div><span>Latest position (left / top)</span><strong>{Math.round(event.position.x * 100)}% / {Math.round(event.position.y * 100)}%</strong></div>}
          </>}
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
        `${e.title} ${e.description} ${e.trackId || ""} ${e.personName || ""}`
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
      <IncidentHistory />
      <EventSearch />
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
