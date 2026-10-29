"use client";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_GEMINI_MODEL } from "@/lib/gemini-model";
import {
  Activity,
  ArrowDown,
  ArrowUpRight,
  ArrowRight,
  Camera as CameraIcon,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileText,
  Globe,
  KeyRound,
  Link2,
  LoaderCircle,
  Mail,
  MessagesSquare,
  Mic,
  MoreHorizontal,
  Phone,
  Plug,
  Plus,
  Radio,
  RefreshCw,
  ScanFace,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TriangleAlert,
  Upload,
  User,
  Users,
  Volume2,
  Workflow,
  Zap,
  Bell,
  Webhook,
  X,
  Copy,
} from "lucide-react";
import { useOdin } from "./odin-context";
import {
  Button,
  PageHeading,
  Badge,
  Modal,
  Field,
  Empty,
  Spinner,
  Toggle,
  date,
  time,
  downloadJson,
} from "./common";
import { faceDetector, fileImage } from "@/lib/inference";
import type {
  Integration,
  Person,
  Settings as SettingsType,
} from "@/lib/types";
const providers = [
  {
    type: "slack",
    name: "Slack",
    description: "Keep your team in the loop.",
    letter: "#",
    color: "purple",
  },
  {
    type: "discord",
    name: "Discord",
    description: "Bring alerts to your community.",
    letter: "D",
    color: "blue",
  },
  {
    type: "webhook",
    name: "Webhooks",
    description: "Connect to anything you build.",
    letter: "↗",
    color: "lime",
  },
  {
    type: "mcp",
    name: "MCP server",
    description: "Give your workflows new tools.",
    letter: "M",
    color: "orange",
  },
];
export function IntegrationsPage() {
  const { data, persist, remove, notify, api, refresh } = useOdin();
  const [adding, setAdding] = useState(""),
    [name, setName] = useState(""),
    [endpoint, setEndpoint] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [discovering, setDiscovering] = useState(""),
    [detail, setDetail] = useState<Integration | null>(null),
    [deleteId, setDeleteId] = useState("");
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await persist("integrations", {
        id: crypto.randomUUID(),
        name: name || providers.find((p) => p.type === adding)?.name,
        type: adding,
        endpoint,
        enabled: true,
        status: "saved",
      });
      notify("Connection saved. Add it to a workflow action.");
      setAdding("");
      setName("");
      setEndpoint("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function discover(i: Integration) {
    setDiscovering(i.id);
    try {
      const r = await api("integrations", { id: i.id });
      await refresh();
      setDetail({ ...i, tools: r.tools, status: "connected" });
      notify(`${r.tools.length} tools discovered`);
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setDiscovering("");
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="BETTER, CONNECTED"
        title="Integrated Tools"
        description="Connect what Odin sees to the tools you already use."
      >
        <Badge tone="lime">
          <Plug size={12} />
          {data!.integrations.filter((i) => i.enabled).length} enabled
        </Badge>
      </PageHeading>
      <div className="section-label">MAKE THE CONNECTION</div>
      <div className="provider-grid">
        {providers.map((p) => (
          <article className="provider-card surface" key={p.type}>
            <span className={`provider-icon ${p.color}`}>{p.letter}</span>
            <h3>{p.name}</h3>
            <p>{p.description}</p>
            <Button
              onClick={() => {
                setAdding(p.type);
                setError("");
              }}
            >
              Connect <Plus size={14} />
            </Button>
          </article>
        ))}
      </div>
      <section className="surface connections">
        <div className="panel-title">
          <h2>
            <Plug size={17} />
            Your connections
          </h2>
          <Badge>{data!.integrations.length}</Badge>
        </div>
        {data!.integrations.length ? (
          data!.integrations.map((i) => (
            <div className="connection-row" key={i.id}>
              <span
                className={`provider-icon small ${providers.find((p) => p.type === i.type)?.color || "lime"}`}
              >
                {providers.find((p) => p.type === i.type)?.letter || "↗"}
              </span>
              <div>
                <strong>{i.name}</strong>
                <small>
                  {i.type.toUpperCase()} ·{" "}
                  {(() => {
                    try {
                      return new URL(i.endpoint).hostname;
                    } catch {
                      return "Provider connection";
                    }
                  })()}
                </small>
              </div>
              <Badge tone={i.enabled ? "lime" : "neutral"}>
                {i.enabled ? "Enabled" : "Paused"}
              </Badge>
              {i.type === "mcp" && (
                <Button
                  disabled={discovering === i.id}
                  onClick={() => void discover(i)}
                >
                  {discovering === i.id ? (
                    <Spinner text="Discovering…" />
                  ) : (
                    <>
                      <RefreshCw size={13} />
                      Discover tools
                    </>
                  )}
                </Button>
              )}
              <Toggle
                checked={i.enabled}
                label={`Enable ${i.name}`}
                onChange={async () => {
                  try {
                    await persist("integrations", {
                      ...i,
                      enabled: !i.enabled,
                    });
                  } catch (e) {
                    notify((e as Error).message, "error");
                  }
                }}
              />
              <button
                className="icon-btn"
                title="Delete connection"
                onClick={() => setDeleteId(i.id)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))
        ) : (
          <Empty
            icon={Link2}
            title="A world of possibilities"
            text="Connect a tool above, then choose it in a workflow action node."
          />
        )}
      </section>
      <div className="section-label">BUILT-IN RESPONSES</div>
      <div className="builtins-grid">
        {[
          {
            name: "Browser notifications",
            icon: Bell,
            ready: true,
            text: "In-app alerts work immediately. Enable system notifications in Settings.",
          },
          {
            name: "Voice announcements",
            icon: Volume2,
            ready: true,
            text: "Spoken alerts through your browser while monitoring is active.",
          },
          {
            name: "Email",
            icon: Mail,
            ready: data!.capabilities.email,
            text: "Send incident summaries through Resend. Requires provider credentials.",
          },
          {
            name: "SMS",
            icon: MessagesSquare,
            ready: data!.capabilities.sms,
            text: "Text your team through Twilio. Requires a configured sender number.",
          },
          {
            name: "Voice calls",
            icon: Phone,
            ready: data!.capabilities.call,
            text: "Call a contact through Vapi with an event summary.",
          },
          {
            name: "Visual reasoning",
            icon: Sparkles,
            ready: data!.capabilities.ai,
            text: "Connect Gemini in Settings for scene analysis and conversational answers.",
          },
        ].map((p) => (
          <article className="surface builtin" key={p.name}>
            <p.icon size={21} />
            <div>
              <h3>{p.name}</h3>
              <p>{p.text}</p>
            </div>
            <Badge tone={p.ready ? "lime" : "neutral"}>
              {p.ready ? "Available" : "Setup needed"}
            </Badge>
          </article>
        ))}
      </div>
      {adding && (
        <Modal
          title={`Connect ${providers.find((p) => p.type === adding)?.name}`}
          subtitle={
            adding === "mcp"
              ? "Use a Streamable HTTP MCP endpoint."
              : "Create an incoming webhook in your service, then paste its URL."
          }
          onClose={() => setAdding("")}
        >
          <form onSubmit={add}>
            <Field label="Connection name">
              <input
                autoFocus
                required
                maxLength={160}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Security operations"
              />
            </Field>
            <Field
              label={adding === "mcp" ? "MCP endpoint" : "Webhook URL"}
              hint="Only public HTTPS endpoints are supported. Connections are stored in your private workspace."
            >
              <input
                type="url"
                required
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder={
                  adding === "mcp"
                    ? "https://your-server.example/mcp"
                    : "https://hooks.example.com/…"
                }
              />
            </Field>
            {adding === "mcp" && (
              <div className="info-box">
                <Plug size={18} />
                <p>
                  Odin supports JSON-RPC tool discovery and execution over
                  Streamable HTTP. Authenticated servers can use the server-side
                  MCP_BEARER_TOKEN setting.
                </p>
              </div>
            )}
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions">
              <Button onClick={() => setAdding("")}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={busy}>
                {busy ? (
                  <Spinner text="Saving…" />
                ) : (
                  <>
                    Save connection <Link2 size={14} />
                  </>
                )}
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {detail && (
        <Modal
          title={`${detail.name} tools`}
          subtitle={`${detail.tools?.length || 0} tools available on this server`}
          onClose={() => setDetail(null)}
        >
          <div className="tool-list">
            {detail.tools?.map((t) => (
              <details key={t.name}>
                <summary>
                  <Plug size={15} />
                  <strong>{t.name}</strong>
                  <ChevronDown size={14} />
                </summary>
                <p>{t.description}</p>
                <pre>{JSON.stringify(t.inputSchema, null, 2)}</pre>
              </details>
            ))}
          </div>
        </Modal>
      )}
      {deleteId && (
        <Modal
          title="Remove this connection?"
          subtitle="Workflow actions using it will need a new connection."
          onClose={() => setDeleteId("")}
        >
          <div className="modal-actions">
            <Button onClick={() => setDeleteId("")}>Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                try {
                  await remove("integrations", deleteId);
                  setDeleteId("");
                  notify("Connection removed");
                } catch (e) {
                  notify((e as Error).message, "error");
                }
              }}
            >
              Remove connection
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function ChatPage() {
  const { data, api, refresh, notify, aiKey, navigate, remove } = useOdin();
  const [selected, setSelected] = useState<string[]>([]),
    [input, setInput] = useState(""),
    [busy, setBusy] = useState(false),
    [clear, setClear] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const messages = [...data!.messages].sort(
    (a, b) => a.timestamp - b.timestamp,
  );
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length, busy]);
  async function send(value = input) {
    if (!value.trim() || !selected.length || busy) return;
    setBusy(true);
    try {
      await api("chat", { message: value, cameraIds: selected });
      setInput("");
      await refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="A NEW KIND OF CONVERSATION"
        title="Camera Chat"
        description="Ask your cameras. Connect the dots."
      >
        <Badge tone={aiKey || data!.capabilities.ai ? "purple" : "neutral"}>
          <Sparkles size={12} />
          {aiKey || data!.capabilities.ai
            ? "Gemini connected"
            : "Event summary mode"}
        </Badge>
        {messages.length > 0 && (
          <Button onClick={() => setClear(true)}>
            <Trash2 size={14} />
            Clear history
          </Button>
        )}
      </PageHeading>
      <div className="chat-layout surface">
        <aside className="chat-cameras">
          <div className="chat-cameras-heading">
            <h3>Select cameras</h3>
            <span>{selected.length} selected</span>
          </div>
          <p>Give your conversation a perspective.</p>
          <button
            className="select-all"
            onClick={() =>
              setSelected(
                selected.length === data!.cameras.length
                  ? []
                  : data!.cameras.map((c) => c.id),
              )
            }
          >
            {selected.length === data!.cameras.length
              ? "Deselect all"
              : "Select all cameras"}
          </button>
          <div className="chat-camera-list">
            {data!.cameras.map((c) => (
              <button
                className={selected.includes(c.id) ? "selected" : ""}
                onClick={() =>
                  setSelected((s) =>
                    s.includes(c.id)
                      ? s.filter((x) => x !== c.id)
                      : [...s, c.id],
                  )
                }
                key={c.id}
              >
                <img src={c.thumbnail || "/images/camera-2.jpg"} alt="" />
                <div>
                  <strong>{c.name}</strong>
                  <small>
                    {c.location}
                    {c.source === "demo" ? " · Sample" : ""}
                  </small>
                </div>
                <span className="check-square">
                  {selected.includes(c.id) && <Check size={12} />}
                </span>
              </button>
            ))}
          </div>
          <div className="chat-source-note">
            <ShieldCheck size={15} />
            <span>
              Answers are grounded in your selected cameras' event history.
            </span>
          </div>
        </aside>
        <section className="chat-conversation">
          <div className="chat-messages">
            {messages.length ? (
              messages.map((m) => (
                <div className={`chat-message ${m.role}`} key={m.id}>
                  <span className="message-avatar">
                    {m.role === "assistant" ? (
                      <Eye size={18} />
                    ) : (
                      <User size={17} />
                    )}
                  </span>
                  <div>
                    <div className="message-author">
                      {m.role === "assistant" ? "Odin" : "You"}
                      <time>{time(m.timestamp)}</time>
                    </div>
                    <div className="message-content">{m.content}</div>
                    <div className="message-sources">
                      {m.cameraIds.map((id) => (
                        <Badge key={id}>
                          {data!.cameras.find((c) => c.id === id)?.name ||
                            "Removed camera"}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="chat-welcome">
                <div className="chat-orb">
                  <Eye size={38} />
                </div>
                <span className="eyebrow">MORE THAN A CAMERA FEED</span>
                <h2>
                  See the story
                  <br />
                  behind the scene<span>.</span>
                </h2>
                <p>
                  Select one or more cameras and start a conversation.
                  <br />
                  Your world has a lot to tell you.
                </p>
                <div className="suggestion-grid">
                  {[
                    "What needs my attention?",
                    "Summarize recent activity",
                    "Which cameras have warnings?",
                    "What happened at the entrance?",
                  ].map((s) => (
                    <button
                      disabled={!selected.length}
                      onClick={() => void send(s)}
                      key={s}
                    >
                      {s}
                      <ArrowUpRight size={15} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {busy && (
              <div className="chat-message assistant">
                <span className="message-avatar">
                  <Eye size={18} />
                </span>
                <Spinner text="Connecting the dots…" />
              </div>
            )}
            <div ref={end} />
          </div>
          <div className="chat-composer">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <input
                value={input}
                maxLength={4000}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  selected.length
                    ? "Ask about your selected cameras…"
                    : "Select cameras to start a conversation…"
                }
                disabled={!selected.length || busy}
                aria-label="Message Odin"
              />
              <button
                type="submit"
                className="send-btn"
                disabled={!input.trim() || !selected.length || busy}
                aria-label="Send message"
              >
                <ArrowRight size={19} />
              </button>
            </form>
            <p>
              {aiKey || data!.capabilities.ai
                ? "AI responses may be incomplete. Verify important observations."
                : "Event summaries work now. Connect Gemini in Settings for conversational answers."}{" "}
              {!aiKey && !data!.capabilities.ai && (
                <button onClick={() => navigate("settings")}>
                  Connect Gemini <ArrowUpRight size={11} />
                </button>
              )}
            </p>
          </div>
        </section>
      </div>
      {clear && (
        <Modal
          title="Clear chat history?"
          subtitle="Your saved conversation messages will be permanently removed."
          onClose={() => setClear(false)}
        >
          <div className="modal-actions">
            <Button onClick={() => setClear(false)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  for (const m of messages)
                    await api(
                      "records",
                      { kind: "messages", id: m.id },
                      "DELETE",
                    );
                  await refresh();
                  setClear(false);
                  notify("Chat history cleared");
                } catch (e) {
                  notify((e as Error).message, "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Clear history
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function ReportsPage() {
  const { data, api, refresh, notify, remove } = useOdin();
  const [creating, setCreating] = useState(false),
    [title, setTitle] = useState("Daily intelligence report"),
    [from, setFrom] = useState(localDay()),
    [to, setTo] = useState(localDay()),
    [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [deleteId, setDeleteId] = useState("");
  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("reports", {
        title,
        from: new Date(from + "T00:00:00").getTime(),
        to: new Date(to + "T23:59:59.999").getTime(),
        cameraIds: selected,
      });
      await refresh();
      setCreating(false);
      notify("Your report is ready to download");
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="CLARITY, ON THE RECORD"
        title="PDF Summary"
        description="Bring the important moments together. Share the bigger picture."
      >
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus size={16} />
          Create report
        </Button>
      </PageHeading>
      <div className="reports-hero">
        <div>
          <span className="eyebrow">YOUR DAILY PERSPECTIVE</span>
          <h2>
            Less footage.
            <br />
            More understanding<span>.</span>
          </h2>
          <p>
            Camera activity, critical events, and actionable summaries.
            <br />
            All in one clear, downloadable PDF.
          </p>
          <Button onClick={() => setCreating(true)}>
            Create your next report <ArrowUpRight size={15} />
          </Button>
        </div>
        <div className="report-illustration">
          <div className="paper-back" />
          <div className="paper-front">
            <div>
              <Eye size={19} />
              <span>odin.</span>
              <small>INTELLIGENCE REPORT</small>
            </div>
            <i />
            <i />
            <div className="paper-chart">
              {[25, 45, 32, 65, 50, 80, 60, 95, 70, 85].map((h, i) => (
                <b style={{ height: h + "%" }} key={i} />
              ))}
            </div>
            <i />
            <i />
            <i />
            <span className="paper-check">
              <Check size={17} />
            </span>
          </div>
          <span className="report-file-badge">
            <FileText size={16} />
            PDF
          </span>
        </div>
      </div>
      <section className="surface">
        <div className="panel-title">
          <h2>Your reports</h2>
          <Badge>{data!.reports.length} documents</Badge>
        </div>
        {data!.reports.length ? (
          <div className="report-list">
            {[...data!.reports]
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((r) => (
                <div className="report-row" key={r.id}>
                  <span className="report-icon">
                    <FileText size={22} />
                  </span>
                  <div>
                    <h3>{r.title}</h3>
                    <p>
                      {date(r.from)} — {date(r.to)} · {r.eventCount} events
                    </p>
                    <small>{r.summary}</small>
                  </div>
                  <Badge>PDF</Badge>
                  <a
                    className="btn secondary"
                    href={`/api/reports/${r.id}`}
                    download
                  >
                    <Download size={14} />
                    Download
                  </a>
                  <button
                    className="icon-btn"
                    title="Delete report"
                    onClick={() => setDeleteId(r.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
          </div>
        ) : (
          <Empty
            icon={FileText}
            title="Your first report is a few clicks away"
            text="Choose a date range and cameras. Odin creates a PDF of the recorded events."
          />
        )}
      </section>
      {creating && (
        <Modal
          title="Create an intelligence report"
          subtitle="A clear record of what happened, when it mattered."
          onClose={() => setCreating(false)}
        >
          <form onSubmit={generate}>
            <Field label="Report title">
              <input
                autoFocus
                required
                maxLength={160}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <div className="form-grid">
              <Field label="From">
                <input
                  required
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </Field>
              <Field label="To">
                <input
                  required
                  type="date"
                  min={from}
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </Field>
            </div>
            <Field
              label="Cameras"
              hint="Leave all unselected to include every camera."
            >
              <div className="camera-checkbox-list">
                {data!.cameras.map((c) => (
                  <label key={c.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(c.id)}
                      onChange={() =>
                        setSelected((s) =>
                          s.includes(c.id)
                            ? s.filter((x) => x !== c.id)
                            : [...s, c.id],
                        )
                      }
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </Field>
            <div className="modal-actions">
              <Button onClick={() => setCreating(false)}>Cancel</Button>
              <Button variant="primary" type="submit" disabled={busy}>
                {busy ? (
                  <Spinner text="Creating report…" />
                ) : (
                  <>
                    <FileText size={15} />
                    Generate PDF
                  </>
                )}
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {deleteId && (
        <Modal title="Delete this report?" onClose={() => setDeleteId("")}>
          <div className="modal-actions">
            <Button onClick={() => setDeleteId("")}>Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                try {
                  await remove("reports", deleteId);
                  setDeleteId("");
                  notify("Report deleted");
                } catch (e) {
                  notify((e as Error).message, "error");
                }
              }}
            >
              Delete report
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function FacesPage() {
  const { data, persist, remove, notify, navigate } = useOdin();
  const [enroll, setEnroll] = useState(false),
    [name, setName] = useState(""),
    [role, setRole] = useState("Team member"),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [stage, setStage] = useState(""),
    [error, setError] = useState(""),
    [deleteId, setDeleteId] = useState("");
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose a clear photo with one face.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      setStage("Loading face recognition…");
      const human = await faceDetector();
      setStage("Reading face features…");
      const canvas = await fileImage(file);
      const result = await human.detect(canvas);
      if (result.face.length !== 1 || !result.face[0].embedding?.length)
        throw new Error(
          result.face.length > 1
            ? "Choose a photo with only one face."
            : "No face features could be extracted. Try a clear, front-facing portrait.",
        );
      const face = result.face[0];
      const thumb = document.createElement("canvas");
      thumb.width = 240;
      thumb.height = 240;
      const [x, y, w, h] = face.box;
      const padding = Math.max(w, h) * 0.25;
      const sx = Math.max(0, x - padding),
        sy = Math.max(0, y - padding),
        sw = Math.min(canvas.width - sx, w + padding * 2),
        sh = Math.min(canvas.height - sy, h + padding * 2);
      thumb.getContext("2d")!.drawImage(canvas, sx, sy, sw, sh, 0, 0, 240, 240);
      setStage("Saving to your directory…");
      await persist("faces", {
        id: crypto.randomUUID(),
        name,
        role,
        embedding: Array.from(face.embedding),
        thumbnail: thumb.toDataURL("image/jpeg", 0.8),
        createdAt: Date.now(),
      });
      notify(`${name} added to your face directory`);
      setEnroll(false);
      setFile(null);
      setName("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="A FAMILIAR FACE"
        title="Face recognition"
        description="Help Odin recognize the people you choose to enroll."
      >
        <Button
          variant="primary"
          onClick={() => {
            setEnroll(true);
            setError("");
          }}
        >
          <Plus size={16} />
          Enroll a person
        </Button>
      </PageHeading>
      <div className="face-summary">
        <span className="face-summary-icon">
          <ScanFace size={32} />
        </span>
        <div>
          <h2>Recognition starts with permission.</h2>
          <p>
            Enroll a clear portrait, then enable face detection in the live
            viewer.
            <br />
            Face processing runs on your device. Your directory stays in your
            private workspace.
          </p>
        </div>
        <Badge tone="lime">
          <Users size={13} />
          {data!.faces.length} enrolled
        </Badge>
      </div>
      {data!.faces.length ? (
        <div className="face-grid">
          {data!.faces.map((p) => (
            <article className="surface person-card" key={p.id}>
              <div className="person-photo">
                <img src={p.thumbnail} alt={p.name} />
                <Badge tone="lime">
                  <Check size={11} />
                  Enrolled
                </Badge>
              </div>
              <div>
                <h3>{p.name}</h3>
                <p>{p.role}</p>
                <small>Added {date(p.createdAt)}</small>
                <button
                  className="icon-btn"
                  title={`Remove ${p.name}`}
                  onClick={() => setDeleteId(p.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="surface">
          <Empty
            icon={ScanFace}
            title="Give Odin a familiar face"
            text="Enroll yourself or a consenting team member to enable recognition in live monitoring."
            action={
              <Button onClick={() => setEnroll(true)}>
                <Plus size={15} />
                Enroll your first person
              </Button>
            }
          />
        </section>
      )}
      <div className="info-box">
        <ShieldCheck size={20} />
        <div>
          <strong>Your directory, your control.</strong>
          <p>
            Enroll only people who have agreed. Recognition is a similarity
            estimate; verify matches before acting. Remove an enrollment at any
            time.
          </p>
        </div>
      </div>
      {enroll && (
        <Modal
          title="Enroll a person"
          subtitle="Use a clear, front-facing portrait of one consenting person."
          onClose={() => {
            if (!busy) setEnroll(false);
          }}
        >
          <form onSubmit={add}>
            <div className="form-grid">
              <Field label="Full name">
                <input
                  autoFocus
                  required
                  maxLength={160}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                />
              </Field>
              <Field label="Role">
                <input
                  maxLength={100}
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Team member"
                />
              </Field>
            </div>
            <Field
              label="Portrait photo"
              hint="A JPEG, PNG, or WebP with one clearly visible face."
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </Field>
            <label className="checkbox-label">
              <input type="checkbox" required />I have this person's permission
              to enroll their face.
            </label>
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions">
              <Button disabled={busy} onClick={() => setEnroll(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={busy}>
                {busy ? (
                  <Spinner text={stage} />
                ) : (
                  <>
                    <ScanFace size={16} />
                    Enroll person
                  </>
                )}
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {deleteId && (
        <Modal
          title="Remove this enrollment?"
          subtitle="The face embedding and portrait will be removed from your directory."
          onClose={() => setDeleteId("")}
        >
          <div className="modal-actions">
            <Button onClick={() => setDeleteId("")}>Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                try {
                  await remove("faces", deleteId);
                  setDeleteId("");
                  notify("Enrollment removed");
                } catch (e) {
                  notify((e as Error).message, "error");
                }
              }}
            >
              Remove enrollment
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function SettingsPage() {
  const { data, persist, notify, aiKey, setAiKey } = useOdin();
  const [settings, setSettings] = useState<SettingsType>({ ...data!.settings }),
    [busy, setBusy] = useState(false),
    [keyDraft, setKeyDraft] = useState(aiKey),
    [showKey, setShowKey] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await persist("settings", settings);
      notify("Workspace settings saved");
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  async function notifications() {
    try {
      if (!("Notification" in window))
        throw new Error(
          "System notifications are unavailable in this browser.",
        );
      const result = await Notification.requestPermission();
      notify(
        result === "granted"
          ? "System notifications enabled"
          : "Notifications were not enabled",
        result === "granted" ? "success" : "error",
      );
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="MAKE IT YOURS"
        title="Settings"
        description="A workspace that sees things your way."
      >
        <Button variant="primary" disabled={busy} onClick={() => void save()}>
          {busy ? (
            <Spinner text="Saving…" />
          ) : (
            <>
              <Check size={15} />
              Save changes
            </>
          )}
        </Button>
      </PageHeading>
      <div className="settings-layout">
        <div className="settings-nav">
          <a
            href="#settings"
            onClick={(e) => {
              e.preventDefault();
              document
                .getElementById("workspace-settings")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <Settings size={16} />
            Workspace
          </a>
          <a
            href="#settings"
            onClick={(e) => {
              e.preventDefault();
              document
                .getElementById("intelligence-settings")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <Sparkles size={16} />
            Intelligence
          </a>
          <a
            href="#settings"
            onClick={(e) => {
              e.preventDefault();
              document
                .getElementById("notification-settings")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <Bell size={16} />
            Notifications
          </a>
          <a
            href="#settings"
            onClick={(e) => {
              e.preventDefault();
              document
                .getElementById("data-settings")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <ShieldCheck size={16} />
            Data & privacy
          </a>
        </div>
        <div className="settings-sections">
          <section className="surface settings-section" id="workspace-settings">
            <div className="panel-title">
              <div>
                <h2>Workspace</h2>
                <p>A home for your cameras and ideas.</p>
              </div>
              <Settings size={18} />
            </div>
            <Field label="Workspace name">
              <input
                required
                maxLength={160}
                value={settings.workspaceName}
                onChange={(e) =>
                  setSettings({ ...settings, workspaceName: e.target.value })
                }
              />
            </Field>
            <div className="account-row">
              <span className="avatar">
                {data!.user.name.charAt(0).toUpperCase()}
              </span>
              <div>
                <strong>{data!.user.name}</strong>
                <small>{data!.user.email}</small>
              </div>
              <Badge tone="lime">Owner</Badge>
            </div>
          </section>
          <section
            className="surface settings-section"
            id="intelligence-settings"
          >
            <div className="panel-title">
              <div>
                <h2>Intelligence</h2>
                <p>Choose how Odin understands your world.</p>
              </div>
              <Sparkles size={18} />
            </div>
            <div className="setting-row">
              <div>
                <h3>On-device detection</h3>
                <p>Objects, faces, and motion run in your browser.</p>
              </div>
              <Badge tone="lime">Ready to use</Badge>
            </div>
            <Field
              label={`Object confidence threshold · ${Math.round(settings.confidence * 100)}%`}
              hint="Higher values reduce uncertain detections."
            >
              <input
                type="range"
                min={30}
                max={99}
                value={Math.round(settings.confidence * 100)}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    confidence: Number(e.target.value) / 100,
                  })
                }
              />
            </Field>
            <div className="setting-divider" />
            <div className="setting-row">
              <div>
                <h3>Gemini visual reasoning</h3>
                <p>
                  Scene analysis, AI workflow generation, and camera
                  conversations.
                </p>
              </div>
              <Badge tone={aiKey || data!.capabilities.ai ? "lime" : "neutral"}>
                {aiKey || data!.capabilities.ai
                  ? "Key available"
                  : "Not connected"}
              </Badge>
            </div>
            <Field
              label="Gemini API key"
              hint="Optional. Held in memory for this tab only; never saved to browser storage or the database. Frames are sent to Gemini only when you use visual analysis."
            >
              <div className="key-input">
                <input
                  autoComplete="off"
                  type={showKey ? "text" : "password"}
                  value={keyDraft}
                  onChange={(e) => setKeyDraft(e.target.value)}
                  placeholder={
                    data!.capabilities.ai
                      ? "Server key configured"
                      : "Paste a Gemini API key"
                  }
                />
                <button
                  className="icon-btn"
                  aria-label="Show or hide key"
                  onClick={() => setShowKey((v) => !v)}
                >
                  <Eye size={16} />
                </button>
              </div>
            </Field>
            <div className="key-actions">
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
              >
                Get a Gemini key <ArrowUpRight size={12} />
              </a>
              <Button
                onClick={() => {
                  setAiKey(keyDraft.trim());
                  notify(
                    keyDraft.trim()
                      ? "Gemini key available for this tab. Try an AI analysis to verify it."
                      : "Session key cleared",
                  );
                }}
              >
                {keyDraft ? "Use session key" : "Clear session key"}
                <KeyRound size={13} />
              </Button>
            </div>
            <Field
              label="Gemini model"
              hint={`Default: ${DEFAULT_GEMINI_MODEL}. You can enter another model available to your API key.`}
            >
              <input
                value={settings.model}
                onChange={(e) =>
                  setSettings({ ...settings, model: e.target.value })
                }
                placeholder={DEFAULT_GEMINI_MODEL}
              />
            </Field>
          </section>
          <section
            className="surface settings-section"
            id="notification-settings"
          >
            <div className="panel-title">
              <div>
                <h2>Notifications</h2>
                <p>Stay aware, in a way that works for you.</p>
              </div>
              <Bell size={18} />
            </div>
            <div className="setting-row">
              <div>
                <h3>In-app notifications</h3>
                <p>Display alerts while you monitor cameras.</p>
              </div>
              <Toggle
                checked={settings.notifications}
                label="In-app notifications"
                onChange={() =>
                  setSettings({
                    ...settings,
                    notifications: !settings.notifications,
                  })
                }
              />
            </div>
            <div className="setting-row">
              <div>
                <h3>System notifications</h3>
                <p>Allow the browser to display alerts on your desktop.</p>
              </div>
              <Button onClick={() => void notifications()}>
                Enable <ArrowUpRight size={13} />
              </Button>
            </div>
            <div className="setting-row">
              <div>
                <h3>Voice announcements</h3>
                <p>Allow workflow voice alerts in this browser.</p>
              </div>
              <Toggle
                checked={settings.voice}
                label="Voice announcements"
                onChange={() =>
                  setSettings({ ...settings, voice: !settings.voice })
                }
              />
            </div>
            <div className="info-box">
              <Volume2 size={17} />
              <p>
                Browser and voice actions need an active monitoring tab.
                External email, SMS, and calls use the configured providers.
              </p>
            </div>
          </section>
          <section className="surface settings-section" id="data-settings">
            <div className="panel-title">
              <div>
                <h2>Data & privacy</h2>
                <p>Your world deserves its own space.</p>
              </div>
              <ShieldCheck size={18} />
            </div>
            <Field
              label="Event retention"
              hint="Older event records are removed when your workspace loads. Saved PDF reports keep their original event snapshots."
            >
              <select
                value={settings.retention}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    retention: Number(e.target.value),
                  })
                }
              >
                {[1, 7, 14, 30, 60, 90, 365].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "day" : "days"}
                  </option>
                ))}
              </select>
            </Field>
            <div className="privacy-points">
              <div>
                <CheckCircle2 size={16} />
                Private workspace with signed-in access
              </div>
              <div>
                <CheckCircle2 size={16} />
                Every record is scoped to your account
              </div>
              <div>
                <CheckCircle2 size={16} />
                Provider credentials stay out of client bundles
              </div>
            </div>
            <div className="setting-row">
              <div>
                <h3>Export workspace</h3>
                <p>Download cameras, workflows, events, and reports as JSON.</p>
              </div>
              <Button
                onClick={() =>
                  downloadJson("odin-workspace.json", {
                    cameras: data!.cameras,
                    workflows: data!.workflows,
                    events: data!.events,
                    reports: data!.reports,
                    settings: data!.settings,
                  })
                }
              >
                <Download size={14} />
                Export
              </Button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

export function TriggersPage() {
  const { data, navigate, persist, notify } = useOdin();
  const [query, setQuery] = useState(""),
    [editing, setEditing] = useState<{
      workflowId: string;
      nodeId: string;
      title: string;
      description: string;
      detectionClass: string;
      ruleMode: "object" | "semantic";
    } | null>(null),
    [busy, setBusy] = useState(false);
  const rules = data!.workflows
    .flatMap((flow) =>
      flow.nodes
        .filter((n) => n.type === "rule")
        .map((node) => ({ flow, node })),
    )
    .filter(({ node, flow }) =>
      `${node.title} ${node.description} ${flow.name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  async function saveRule(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      const f = data!.workflows.find((f) => f.id === editing.workflowId)!;
      await persist("workflows", {
        ...f,
        nodes: f.nodes.map((n) =>
          n.id === editing.nodeId
            ? {
                ...n,
                title: editing.title,
                description: editing.description,
                detectionClass: editing.detectionClass,
                ruleMode: editing.ruleMode,
              }
            : n,
        ),
      });
      notify("Detection trigger updated");
      setEditing(null);
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="THE MOMENT THAT MATTERS"
        title="Triggers"
        description="Choose what your cameras look for. Decide what happens next."
      >
        <Button variant="primary" onClick={() => navigate("workflows")}>
          <Plus size={16} />
          Build a trigger
        </Button>
      </PageHeading>
      <div className="activity-stats">
        {[
          { title: "Detection rules", value: rules.length, icon: ScanFace },
          {
            title: "Active rules",
            value: rules.filter((r) => r.flow.enabled).length,
            icon: Zap,
          },
          {
            title: "Detection classes",
            value: new Set(rules.map((r) => r.node.detectionClass)).size,
            icon: Eye,
          },
        ].map((s) => (
          <button key={s.title} onClick={() => {}}>
            <span className="event-symbol">
              <s.icon size={19} />
            </span>
            <span>
              <strong>{s.value}</strong>
              <small>{s.title}</small>
            </span>
          </button>
        ))}
      </div>
      <section className="surface">
        <div className="panel-title">
          <h2>
            <Zap size={16} />
            Detection triggers
          </h2>
          <div className="search-input">
            <Search size={14} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a trigger…"
              aria-label="Search triggers"
            />
          </div>
        </div>
        {rules.length ? (
          rules.map(({ flow, node }) => (
            <div className="trigger-row" key={flow.id + node.id}>
              <span className="trigger-icon">
                <ScanFace size={20} />
              </span>
              <div>
                <button
                  onClick={() =>
                    setEditing({
                      workflowId: flow.id,
                      nodeId: node.id,
                      title: node.title,
                      description: node.description,
                      detectionClass: node.detectionClass || "person",
                      ruleMode: node.ruleMode || "object",
                    })
                  }
                >
                  <h3>{node.title}</h3>
                </button>
                <p>{node.description}</p>
                <small>
                  <Workflow size={10} />
                  {flow.name}
                </small>
              </div>
              <Badge tone="orange">
                {node.ruleMode === "semantic"
                  ? "AI scene rule"
                  : node.detectionClass || "Unconfigured"}
              </Badge>
              <Badge tone={flow.enabled ? "lime" : "neutral"}>
                {flow.enabled ? "Active" : "Paused"}
              </Badge>
              <button
                className="icon-btn"
                title="Open workflow"
                onClick={() => navigate("workflows", flow.id)}
              >
                <ArrowUpRight size={16} />
              </button>
            </div>
          ))
        ) : (
          <Empty
            icon={ScanFace}
            title="Every action starts with a trigger"
            text="Add a detection rule in a workflow to watch for objects, faces, or movement."
          />
        )}
      </section>
      <div className="info-box">
        <Eye size={19} />
        <div>
          <strong>One clear signal. The right response.</strong>
          <p>
            Object triggers match event classes locally. Scene triggers use
            their description and require enabled AI analysis. Connect triggers
            to actions in an active workflow.
          </p>
        </div>
      </div>
      {editing && (
        <Modal
          title="Edit detection trigger"
          subtitle="The rule is shared with its workflow graph."
          onClose={() => setEditing(null)}
        >
          <form onSubmit={saveRule}>
            <Field label="Title">
              <input
                required
                value={editing.title}
                onChange={(e) =>
                  setEditing({ ...editing, title: e.target.value })
                }
              />
            </Field>
            <Field label="Description">
              <textarea
                value={editing.description}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
              />
            </Field>
            <Field label="Evaluation mode">
              <select
                value={editing.ruleMode}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    ruleMode: e.target.value as "object" | "semantic",
                  })
                }
              >
                <option value="object">
                  On-device object, face, or motion detection
                </option>
                <option value="semantic">AI scene understanding</option>
              </select>
            </Field>
            <Field label="Detection class">
              <select
                value={editing.detectionClass}
                onChange={(e) =>
                  setEditing({ ...editing, detectionClass: e.target.value })
                }
              >
                {[
                  "person",
                  "car",
                  "truck",
                  "bicycle",
                  "backpack",
                  "handbag",
                  "dog",
                  "cat",
                  "motion",
                  "known_face",
                  "unknown_face",
                  "*",
                ].map((c) => (
                  <option key={c} value={c}>
                    {c === "*" ? "Any event" : c.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </Field>
            <div className="modal-actions">
              <Button onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={busy}>
                {busy ? (
                  <Spinner text="Saving…" />
                ) : (
                  <>
                    Save trigger
                    <Check size={14} />
                  </>
                )}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
