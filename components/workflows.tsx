"use client";
import { OBJECT_CLASSES } from "@/lib/detection-options";
import { useEffect, useRef, useState } from "react";
import {
  Workflow as WorkflowIcon,
  Plus,
  ArrowUpRight,
  ArrowLeft,
  Camera,
  ScanLine,
  Zap,
  Mic,
  Save,
  Download,
  Upload,
  Maximize,
  Minimize,
  Trash2,
  Copy,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Check,
  Mail,
  Phone,
  Bell,
  Volume2,
  Plug,
  Play,
  Square,
  Search,
  CheckCircle2,
  AlertCircle,
  MousePointer2,
  Minus,
  X,
  Sparkles,
  Move,
  Link2,
  Unlink,
  History,
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
  downloadJson,
  date,
  time,
} from "./common";
import { workflowSchema } from "@/lib/validation";
import { traceWorkflow } from "@/lib/workflow-engine";
import type { Workflow, FlowNode, Event } from "@/lib/types";
const actionNames: Record<string, string> = {
  browser: "Browser notification",
  voice: "Voice announcement",
  email: "Send email",
  sms: "Send SMS",
  call: "Phone call",
  webhook: "Webhook",
  mcp: "MCP tool",
};
const nodeIcons = { input: Camera, rule: ScanLine, action: Zap };
export function WorkflowsPage() {
  const { data, selectedId, navigate, persist, remove, notify } = useOdin();
  const [create, setCreate] = useState(false),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("workflows");
  const current = data!.workflows.find((f) => f.id === selectedId);
  async function add() {
    setBusy(true);
    try {
      const flow: Workflow = {
        id: crypto.randomUUID(),
        name: name || "Untitled workflow",
        description: "Connect your cameras to meaningful actions.",
        enabled: false,
        nodes: [
          {
            id: crypto.randomUUID(),
            type: "input",
            title: "Camera input",
            description: data!.cameras[0]?.name || "Select a camera",
            cameraId: data!.cameras[0]?.id,
            x: 60,
            y: 160,
          },
        ],
        edges: [],
        createdAt: Date.now(),
      };
      await persist("workflows", flow);
      setCreate(false);
      setName("");
      navigate("workflows", flow.id);
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  if (current)
    return (
      <>
        <button className="back-link" onClick={() => navigate("workflows")}>
          <ArrowLeft size={14} />
          All workflows
        </button>
        <WorkflowEditor key={current.id} initial={current} />
      </>
    );
  return (
    <>
      <PageHeading
        eyebrow="FROM SEEING TO DOING"
        title="Workflows"
        description="Your cameras observe. Your workflows take it from there."
      >
        <Button variant="primary" onClick={() => setCreate(true)}>
          <Plus size={16} />
          Create workflow
        </Button>
      </PageHeading>
      <div className="section-toolbar">
        <div className="tabs">
          <button
            className={tab === "workflows" ? "selected" : ""}
            onClick={() => setTab("workflows")}
          >
            Workflows <span>{data!.workflows.length}</span>
          </button>
          <button
            className={tab === "logs" ? "selected" : ""}
            onClick={() => setTab("logs")}
          >
            Execution history <span>{data!.executions.length}</span>
          </button>
        </div>
        <Badge tone="lime">
          {data!.workflows.filter((f) => f.enabled).length} active
        </Badge>
      </div>
      {tab === "workflows" ? (
        <>
          <div className="workflow-cards">
            {data!.workflows.map((f) => (
              <article className="workflow-card surface" key={f.id}>
                <div className="workflow-card-top">
                  <span className="workflow-card-icon">
                    <WorkflowIcon size={23} />
                  </span>
                  <Toggle
                    checked={f.enabled}
                    label={`Activate ${f.name}`}
                    onChange={async () => {
                      try {
                        await persist("workflows", {
                          ...f,
                          enabled: !f.enabled,
                        });
                        notify(
                          f.enabled ? "Workflow paused" : "Workflow activated",
                        );
                      } catch (e) {
                        notify((e as Error).message, "error");
                      }
                    }}
                  />
                </div>
                <Badge tone={f.enabled ? "lime" : "neutral"}>
                  {f.enabled ? "Active" : "Paused"}
                </Badge>
                <button
                  className="workflow-card-title"
                  onClick={() => navigate("workflows", f.id)}
                >
                  <h3>{f.name}</h3>
                  <ArrowUpRight size={18} />
                </button>
                <p>{f.description}</p>
                <div className="mini-flow">
                  <span>
                    <Camera size={17} />
                  </span>
                  <i />
                  <span>
                    <ScanLine size={17} />
                  </span>
                  <i />
                  <span>
                    <Zap size={17} />
                  </span>
                  <small>{f.nodes.length} nodes</small>
                </div>
                <div className="workflow-card-footer">
                  <span>{date(f.createdAt)}</span>
                  <button onClick={() => navigate("workflows", f.id)}>
                    Open workflow <ArrowRightIcon />
                  </button>
                  <button
                    className="icon-btn"
                    title="Duplicate workflow"
                    onClick={async () => {
                      try {
                        await persist("workflows", {
                          ...f,
                          id: crypto.randomUUID(),
                          name: `${f.name} (copy)`,
                          enabled: false,
                          createdAt: Date.now(),
                        });
                        notify("Workflow duplicated");
                      } catch (e) {
                        notify((e as Error).message, "error");
                      }
                    }}
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </article>
            ))}
            <button
              className="new-workflow-card"
              onClick={() => setCreate(true)}
            >
              <span>
                <Plus size={24} />
              </span>
              <h3>Make something happen</h3>
              <p>
                Build a workflow from scratch
                <br />
                or describe it in your own words.
              </p>
            </button>
          </div>
          <div className="info-box workflow-tip">
            <Sparkles size={20} />
            <div>
              <strong>Speak your workflow into existence.</strong>
              <p>
                Open an editor and describe what to watch for. Odin builds a
                draft you can refine.
              </p>
            </div>
          </div>
        </>
      ) : (
        <ExecutionHistory />
      )}
      {create && (
        <Modal
          title="Create a workflow"
          subtitle="Give your cameras a new purpose."
          onClose={() => setCreate(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
          >
            <Field label="Workflow name">
              <input
                autoFocus
                required
                maxLength={160}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Entrance activity alerts"
              />
            </Field>
            <div className="modal-actions">
              <Button onClick={() => setCreate(false)}>Cancel</Button>
              <Button variant="primary" type="submit" disabled={busy}>
                {busy ? (
                  <Spinner text="Creating…" />
                ) : (
                  <>
                    Create workflow
                    <ArrowUpRight size={15} />
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
function ArrowRightIcon() {
  return <ChevronRight size={14} />;
}
export function WorkflowEditor({
  initial,
  compact = false,
  activeEvent,
}: {
  initial: Workflow;
  compact?: boolean;
  activeEvent?: Event;
}) {
  const { data, persist, notify, api, navigate, remove } = useOdin();
  const [flow, setFlow] = useState<Workflow>(() => structuredClone(initial)),
    [dirty, setDirty] = useState(false),
    [saving, setSaving] = useState(false),
    [editing, setEditing] = useState<FlowNode | null>(null),
    [nodeMenu, setNodeMenu] = useState(false),
    [connecting, setConnecting] = useState(""),
    [selectedEdge, setSelectedEdge] = useState(""),
    [zoom, setZoom] = useState(compact ? 0.8 : 1),
    [prompt, setPrompt] = useState(""),
    [generating, setGenerating] = useState(false),
    [listening, setListening] = useState(false),
    [expanded, setExpanded] = useState(false),
    [rename, setRename] = useState(false),
    [deleteFlow, setDeleteFlow] = useState(false),
    [voiceDialog, setVoiceDialog] = useState(false);
  const highlighted = new Set(
    activeEvent ? traceWorkflow(flow, activeEvent, true) : [],
  );
  const importRef = useRef<HTMLInputElement>(null),
    drag = useRef<{
      id: string;
      x: number;
      y: number;
      nodeX: number;
      nodeY: number;
    } | null>(null),
    recognition = useRef<any>(null);
  useEffect(() => () => recognition.current?.stop(), []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const update = (next: Workflow) => {
    setFlow(next);
    setDirty(true);
  };
  async function saveFlow(value = flow) {
    setSaving(true);
    try {
      await persist("workflows", value);
      setDirty(false);
      notify("Workflow saved");
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }
  function addNode(type: FlowNode["type"]) {
    const count = flow.nodes.filter((n) => n.type === type).length;
    const node: FlowNode = {
      id: crypto.randomUUID(),
      type,
      title:
        type === "input"
          ? "Camera input"
          : type === "rule"
            ? "Detection rule"
            : "Action",
      description:
        type === "input" ? data!.cameras[0]?.name || "Select a camera" : "",
      x: type === "input" ? 60 : type === "rule" ? 360 : 680,
      y: 60 + (count % 3) * 165,
      ...(type === "input"
        ? { cameraId: data!.cameras[0]?.id }
        : type === "rule"
          ? { detectionClass: "person", ruleMode: "object" as const }
          : { action: "browser", cooldown: 60 }),
    };
    update({ ...flow, nodes: [...flow.nodes, node] });
    setNodeMenu(false);
    setEditing(node);
  }
  function connect(target: string) {
    if (!connecting) return;
    const source = flow.nodes.find((n) => n.id === connecting),
      to = flow.nodes.find((n) => n.id === target);
    if (!source || !to || source.id === to.id) return;
    if (
      flow.edges.some((e) => e.source === connecting && e.target === target)
    ) {
      notify("These nodes are already connected");
      setConnecting("");
      return;
    }
    const next = {
      ...flow,
      edges: [
        ...flow.edges,
        { id: crypto.randomUUID(), source: connecting, target },
      ],
    };
    const valid = workflowSchema.safeParse(next);
    if (!valid.success) {
      notify(valid.error.issues[0].message, "error");
      setConnecting("");
      return;
    }
    update(next);
    setConnecting("");
  }
  function pointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const d = drag.current;
    const x = Math.max(10, Math.min(1100, d.nodeX + (e.clientX - d.x) / zoom)),
      y = Math.max(10, Math.min(550, d.nodeY + (e.clientY - d.y) / zoom));
    setFlow((f) => ({
      ...f,
      nodes: f.nodes.map((n) => (n.id === d.id ? { ...n, x, y } : n)),
    }));
    setDirty(true);
  }
  async function generate() {
    setGenerating(true);
    try {
      const result = await api("generate", {
        prompt,
        cameraId: flow.nodes.find((n) => n.type === "input")?.cameraId,
      });
      update({ ...result.workflow, id: flow.id, createdAt: flow.createdAt });
      notify(
        result.mode === "template"
          ? "Draft created from a detection template. Review the rule before activation."
          : "AI workflow draft ready to review",
      );
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setGenerating(false);
    }
  }
  function voice() {
    const R =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!R) {
      notify(
        "Speech recognition is unavailable in this browser. Type your description instead.",
        "error",
      );
      return;
    }
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const r = new R();
    recognition.current = r;
    r.lang = "en-US";
    r.interimResults = true;
    r.onresult = (e: any) =>
      setPrompt(
        Array.from(e.results)
          .map((v: any) => v[0].transcript)
          .join(" "),
      );
    r.onend = () => setListening(false);
    r.onerror = (e: any) => {
      setListening(false);
      notify(`Voice input: ${e.error}`, "error");
    };
    r.start();
    setListening(true);
  }
  async function importFlow(file: File) {
    try {
      if (file.size > 500000)
        throw new Error("Workflow file must be under 500 KB.");
      const parsed = workflowSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      update({ ...parsed.data, id: flow.id, enabled: false });
      notify("Workflow imported as a paused draft");
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }
  const graph = (
    <>
      <div className="graph-toolbar">
        <div className="graph-toolbar-left">
          <span className="graph-mode">
            <MousePointer2 size={14} />
            Editor
          </span>
          <span className="toolbar-divider" />
          {connecting ? (
            <span className="connect-instruction">
              <Link2 size={13} />
              Select a node's left port{" "}
              <button onClick={() => setConnecting("")}>
                <X size={13} />
              </button>
            </span>
          ) : (
            <span className="graph-hint">Drag nodes. Connect the dots.</span>
          )}
        </div>
        <div className="graph-toolbar-actions">
          <div className="dropdown-root">
            <Button onClick={() => setNodeMenu((v) => !v)}>
              <Plus size={14} />
              Add node
              <ChevronDown size={12} />
            </Button>
            {nodeMenu && (
              <div className="dropdown-menu">
                {(["input", "rule", "action"] as const).map((t) => {
                  const Icon = nodeIcons[t];
                  return (
                    <button key={t} onClick={() => addNode(t)}>
                      <Icon size={16} />
                      {t === "input"
                        ? "Camera input"
                        : t === "rule"
                          ? "Detection rule"
                          : "Action"}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <Button
            className="graph-voice"
            onClick={() => {
              setVoiceDialog(true);
              voice();
            }}
          >
            <Mic size={13} />
            Voice
          </Button>
          <Button
            className="graph-save"
            disabled={saving}
            onClick={() => void saveFlow()}
          >
            <Save size={13} />
            Save
          </Button>
          <button
            className="icon-btn graph-import"
            title="Import JSON"
            onClick={() => importRef.current?.click()}
          >
            <Upload size={16} />
            <span>Import</span>
          </button>
          <button
            className="icon-btn graph-download"
            title="Download JSON"
            onClick={() =>
              downloadJson(
                `${flow.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`,
                flow,
              )
            }
          >
            <Download size={16} />
            <span>Download</span>
          </button>
          <button
            className="icon-btn graph-expand"
            title={expanded ? "Exit expanded view" : "Expand graph"}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <Minimize size={16} /> : <Maximize size={16} />}
            <span>{expanded ? "Shrink" : "Expand"}</span>
          </button>
          <Button onClick={() => setZoom(compact ? 0.8 : 1)}>Home</Button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              if (e.target.files?.[0]) void importFlow(e.target.files[0]);
              e.target.value = "";
            }}
          />
        </div>
      </div>
      <div className="graph-scroll">
        <div
          className="graph-sizing"
          style={{ width: 1280 * zoom, height: (compact ? 440 : 620) * zoom }}
        >
          <div
            className="graph-canvas"
            style={{ transform: `scale(${zoom})`, height: compact ? 440 : 620 }}
            onPointerMove={pointerMove}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
            onClick={() => setSelectedEdge("")}
          >
            <svg
              className="graph-edges"
              width="1280"
              height={compact ? 440 : 620}
            >
              <defs>
                <marker
                  id={`arrow-${flow.id}`}
                  markerWidth="8"
                  markerHeight="8"
                  refX="6"
                  refY="4"
                  orient="auto"
                >
                  <path d="M0,0 L8,4 L0,8" fill="#899b69" />
                </marker>
              </defs>
              {flow.edges.map((edge) => {
                const source = flow.nodes.find((n) => n.id === edge.source),
                  target = flow.nodes.find((n) => n.id === edge.target);
                if (!source || !target) return null;
                const sx = source.x + 218,
                  sy = source.y + 66,
                  tx = target.x,
                  ty = target.y + 66;
                const path = `M ${sx} ${sy} C ${sx + 80} ${sy},${tx - 80} ${ty},${tx} ${ty}`;
                return (
                  <g
                    key={edge.id}
                    className={`${selectedEdge === edge.id ? "selected" : ""} ${highlighted.has(edge.source) && highlighted.has(edge.target) ? "executing" : ""}`}
                  >
                    <path
                      d={path}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={15}
                      className="edge-hit"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEdge(edge.id);
                      }}
                    />
                    <path
                      d={path}
                      className="edge-line"
                      fill="none"
                      strokeWidth={1.7}
                      markerEnd={`url(#arrow-${flow.id})`}
                    />
                  </g>
                );
              })}
            </svg>
            {flow.nodes.map((node) => {
              const Icon = nodeIcons[node.type];
              return (
                <div
                  key={node.id}
                  className={`flow-node ${node.type} ${connecting === node.id ? "connecting" : ""} ${highlighted.has(node.id) ? "executing" : ""}`}
                  style={{ left: node.x, top: node.y }}
                  onDoubleClick={() => setEditing(node)}
                >
                  <div
                    className="flow-node-header"
                    onPointerDown={(e) => {
                      if ((e.target as HTMLElement).closest("button")) return;
                      e.preventDefault();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      drag.current = {
                        id: node.id,
                        x: e.clientX,
                        y: e.clientY,
                        nodeX: node.x,
                        nodeY: node.y,
                      };
                    }}
                  >
                    <span className="node-icon">
                      <Icon size={17} />
                    </span>
                    <span>
                      {node.type === "input"
                        ? "VIDEO INPUT"
                        : node.type === "rule"
                          ? "DETECTION RULE"
                          : "ACTION"}
                    </span>
                    <button
                      aria-label={`Edit ${node.title}`}
                      onClick={() => setEditing(node)}
                    >
                      <MoreHorizontal size={17} />
                    </button>
                  </div>
                  <button
                    className="flow-node-body"
                    onClick={() => setEditing(node)}
                  >
                    <h4>{node.title}</h4>
                    <p>{node.description || "Click to configure this node"}</p>
                    <span className="node-chip">
                      {node.type === "input" ? (
                        <>
                          <Camera size={11} />
                          {data!.cameras.find((c) => c.id === node.cameraId)
                            ?.name || "Select camera"}
                        </>
                      ) : node.type === "rule" ? (
                        <>
                          <ScanLine size={11} />
                          {node.detectionClass || "No class selected"}
                        </>
                      ) : (
                        <>
                          <Zap size={11} />
                          {actionNames[node.action || "browser"]}
                        </>
                      )}
                    </span>
                  </button>
                  {node.type !== "input" && (
                    <button
                      className={`node-port in ${connecting ? "ready" : ""}`}
                      aria-label={`Connect to ${node.title}`}
                      title="Connect an incoming edge"
                      onClick={(e) => {
                        e.stopPropagation();
                        connect(node.id);
                      }}
                    />
                  )}
                  {node.type !== "action" && (
                    <button
                      className="node-port out"
                      aria-label={`Connect from ${node.title}`}
                      title="Start a connection"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConnecting(node.id);
                      }}
                    />
                  )}
                </div>
              );
            })}
            <div className="graph-watermark">
              <EyeLogo />
              ODIN WORKFLOW ENGINE
            </div>
          </div>
        </div>
      </div>
      <div className="graph-bottom-bar">
        <span>
          <span className="status-dot" />
          {flow.nodes.length} nodes <span>·</span> {flow.edges.length}{" "}
          connections
        </span>
        {selectedEdge && (
          <button
            className="text-red"
            onClick={() => {
              update({
                ...flow,
                edges: flow.edges.filter((e) => e.id !== selectedEdge),
              });
              setSelectedEdge("");
            }}
          >
            <Unlink size={13} />
            Remove connection
          </button>
        )}
        <div>
          <button
            className="icon-btn"
            title="Zoom out"
            onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
          >
            <Minus size={14} />
          </button>
          <button className="zoom-value" onClick={() => setZoom(1)}>
            {Math.round(zoom * 100)}%
          </button>
          <button
            className="icon-btn"
            title="Zoom in"
            onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    </>
  );
  return (
    <div className={expanded ? "workflow-expanded" : ""}>
      {!compact && (
        <PageHeading
          eyebrow="VISUAL AUTOMATION"
          title={flow.name}
          description={flow.description}
        >
          <Button variant="ghost" onClick={() => setRename(true)}>
            Rename
          </Button>
          <Button
            variant="ghost"
            onClick={() => setDeleteFlow(true)}
            title="Delete workflow"
          >
            <Trash2 size={16} />
          </Button>
          <Badge tone={flow.enabled ? "lime" : "neutral"}>
            {flow.enabled ? "Active" : "Paused"}
          </Badge>
          <Toggle
            checked={flow.enabled}
            label="Activate workflow"
            onChange={() => {
              const next = { ...flow, enabled: !flow.enabled };
              const valid = workflowSchema.safeParse(next);
              if (!valid.success) {
                notify(valid.error.issues[0].message, "error");
                return;
              }
              update(next);
              void saveFlow(next);
            }}
          />
          <Button
            variant="primary"
            disabled={saving}
            onClick={() => void saveFlow()}
          >
            {saving ? (
              <Spinner text="Saving…" />
            ) : (
              <>
                <Save size={15} />
                Save workflow{dirty && <span className="unsaved-dot" />}
              </>
            )}
          </Button>
        </PageHeading>
      )}
      {!compact && (
        <div className="workflow-prompt">
          <span className="prompt-icon">
            <Sparkles size={22} />
          </span>
          <div>
            <label htmlFor="flow-prompt">
              A thought can become a workflow.
            </label>
            <input
              id="flow-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && prompt.length >= 5) void generate();
              }}
              placeholder="When a person enters the warehouse, send me a browser notification…"
            />
          </div>
          <button
            className={`icon-btn ${listening ? "text-red" : ""}`}
            title="Describe workflow with your voice"
            onClick={voice}
          >
            <Mic size={18} />
          </button>
          <Button
            onClick={() => void generate()}
            disabled={generating || prompt.length < 5}
          >
            {generating ? (
              <Spinner text="Building…" />
            ) : (
              <>
                Build draft
                <ArrowUpRight size={14} />
              </>
            )}
          </Button>
        </div>
      )}
      <section
        className={`surface workflow-editor ${compact ? "compact" : ""}`}
      >
        {graph}
      </section>
      {compact && (
        <div className="compact-save">
          <span className="muted">
            {dirty
              ? "You have unsaved changes."
              : "Double-click any node to configure it."}
          </span>
          <Button
            variant="primary"
            disabled={saving || !dirty}
            onClick={() => void saveFlow()}
          >
            <Save size={14} />
            Save changes
          </Button>
        </div>
      )}
      {!compact && (
        <>
          <div className="workflow-guide">
            <div>
              <Camera size={17} />
              <span>
                <strong>Observe</strong>Connect a camera source
              </span>
            </div>
            <ChevronRight size={15} />
            <div>
              <ScanLine size={17} />
              <span>
                <strong>Understand</strong>Choose a detection rule
              </span>
            </div>
            <ChevronRight size={15} />
            <div>
              <Zap size={17} />
              <span>
                <strong>Act</strong>Trigger the right response
              </span>
            </div>
          </div>
          <ExecutionHistory workflowId={flow.id} />
        </>
      )}
      {voiceDialog && (
        <Modal
          title="Describe your workflow"
          subtitle="Speak or type the rule and response you want."
          onClose={() => {
            recognition.current?.stop();
            setVoiceDialog(false);
          }}
        >
          <Field label="Workflow instructions">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="If someone leaves a bag unattended, show a browser alert…"
            />
          </Field>
          <div className="modal-actions">
            <Button onClick={voice}>
              <Mic size={14} />
              {listening ? "Stop listening" : "Start voice input"}
            </Button>
            <Button
              variant="primary"
              disabled={generating || prompt.length < 5}
              onClick={async () => {
                await generate();
                setVoiceDialog(false);
              }}
            >
              {generating ? (
                <Spinner text="Building…" />
              ) : (
                "Build workflow draft"
              )}
            </Button>
          </div>
        </Modal>
      )}
      {editing && (
        <NodeEditor
          node={editing}
          previewCameraId={flow.nodes.find(n => n.type === "input")?.cameraId}
          onClose={() => setEditing(null)}
          onSave={(n) => {
            const next = {...flow, nodes: flow.nodes.map(x => x.id === n.id ? n : x)};
            update(next);
            setEditing(null);
            void saveFlow(next);
          }}
          onDelete={() => {
            update({
              ...flow,
              nodes: flow.nodes.filter((n) => n.id !== editing.id),
              edges: flow.edges.filter(
                (e) => e.source !== editing.id && e.target !== editing.id,
              ),
            });
            setEditing(null);
          }}
        />
      )}
      {rename && (
        <Modal title="Workflow details" onClose={() => setRename(false)}>
          <Field label="Name">
            <input
              value={flow.name}
              onChange={(e) => update({ ...flow, name: e.target.value })}
            />
          </Field>
          <Field label="Description">
            <textarea
              value={flow.description}
              onChange={(e) => update({ ...flow, description: e.target.value })}
            />
          </Field>
          <div className="modal-actions">
            <Button variant="primary" onClick={() => setRename(false)}>
              Done
            </Button>
          </div>
        </Modal>
      )}
      {deleteFlow && (
        <Modal
          title="Delete this workflow?"
          subtitle="The workflow graph will be permanently removed. Execution history is retained."
          onClose={() => setDeleteFlow(false)}
        >
          <div className="modal-actions">
            <Button onClick={() => setDeleteFlow(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                try {
                  await remove("workflows", flow.id);
                  navigate("workflows");
                  notify("Workflow deleted");
                } catch (e) {
                  notify((e as Error).message, "error");
                }
              }}
            >
              Delete workflow
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function EyeLogo() {
  return <ScanLine size={16} />;
}
function NodeEditor({
  node,
  previewCameraId,
  onClose,
  onSave,
  onDelete,
}: {
  node: FlowNode;
  previewCameraId?: string;
  onClose: () => void;
  onSave: (n: FlowNode) => void;
  onDelete: () => void;
}) {
  const { data } = useOdin();
  const [draft, setDraft] = useState({ ...node }),
    [previewCamera, setPreviewCamera] = useState(previewCameraId || data!.cameras[0]?.id || ""),
    [showTools, setShowTools] = useState(false),
    [error, setError] = useState("");
  const regionImage = data!.events.find(e => e.cameraId === previewCamera && e.snapshot)?.snapshot || data!.cameras.find(c => c.id === previewCamera)?.thumbnail;
  const line = draft.spatial?.points;
  const dx = line?.length === 2 ? line[1].x - line[0].x : 0;
  const dy = line?.length === 2 ? line[1].y - line[0].y : 1;
  const positiveDirection = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "Top to bottom" : "Bottom to top") : (dy >= 0 ? "Right to left" : "Left to right");
  const negativeDirection = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "Bottom to top" : "Top to bottom") : (dy >= 0 ? "Left to right" : "Right to left");
  const change = (key: string, value: any) =>
    setDraft((d) => ({ ...d, [key]: value }));
  return (
    <Modal
      title={`Edit ${node.type === "input" ? "camera input" : node.type === "rule" ? "detection rule" : "action"}`}
      subtitle="Small instructions. Meaningful outcomes."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.action === "mcp" && draft.toolArguments) {
            try {
              JSON.parse(draft.toolArguments);
            } catch {
              setError("Tool arguments must be valid JSON.");
              return;
            }
          }
          if (draft.ruleMode === "spatial" && (!draft.spatial || (draft.spatial.kind === "line_cross" ? draft.spatial.points.length !== 2 : draft.spatial.points.length < 3))) {
            setError("Draw the region before saving this rule."); return;
          }
          onSave(draft.type === "rule" ? {...draft, detectionClass: draft.detectionClass || "person", ruleMode: draft.ruleMode || "object"} : draft);
        }}
      >
        <Field label="Title">
          <input
            autoFocus
            required
            maxLength={160}
            value={draft.title}
            onChange={(e) => change("title", e.target.value)}
          />
        </Field>
        <Field label="Description">
          <textarea
            value={draft.description}
            maxLength={5000}
            onChange={(e) => {
              change("description", e.target.value);
              setShowTools(
                node.type === "action" && e.target.value.endsWith("@"),
              );
            }}
            placeholder={
              node.type === "action"
                ? "Describe the response. Type @ to browse tools."
                : "What should Odin look for?"
            }
          />
        </Field>
        {showTools && (
          <div className="mention-tools">
            {Object.entries(actionNames).map(([value, label]) => (
              <button
                type="button"
                key={value}
                onClick={() => {
                  change("action", value);
                  change("description", draft.description.replace(/@$/, ""));
                  setShowTools(false);
                }}
              >
                <Zap size={14} />
                {label}
              </button>
            ))}
          </div>
        )}
        {node.type === "input" && (
          <Field label="Camera">
            <select
              value={draft.cameraId || ""}
              onChange={(e) => {
                change("cameraId", e.target.value);
                change(
                  "description",
                  data!.cameras.find((c) => c.id === e.target.value)?.name ||
                    "",
                );
              }}
            >
              <option value="">Select camera</option>
              {data!.cameras.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {node.type === "rule" && (
          <>
            <Field label="Evaluation mode">
              <select
                value={draft.ruleMode || "object"}
                onChange={(e) => {
                  change("ruleMode", e.target.value);
                  if (e.target.value === "spatial" && ["motion", "known_face", "unknown_face"].includes(draft.detectionClass || "")) change("detectionClass", "person");
                  if (e.target.value === "spatial" && !draft.spatial)
                    change("spatial", {kind: "zone_enter", points: [{x: 0.2, y: 0.2}, {x: 0.8, y: 0.2}, {x: 0.8, y: 0.8}, {x: 0.2, y: 0.8}], seconds: 30, direction: "either"});
                }}
              >
                <option value="object">
                  On-device object, face, or motion detection
                </option>
                <option value="spatial">Local zone, line crossing, or dwell time</option>
                <option value="semantic">
                  AI scene understanding (description above)
                </option>
              </select>
            </Field>
            {draft.ruleMode === "spatial" && draft.spatial && (
              <div>
                <Field label="Movement condition">
                  <select value={draft.spatial.kind} onChange={(e) => change("spatial", {...draft.spatial, kind: e.target.value, points: e.target.value === "line_cross" ? [{x: 0.5, y: 0.1}, {x: 0.5, y: 0.9}] : [{x: 0.2, y: 0.2}, {x: 0.8, y: 0.2}, {x: 0.8, y: 0.8}, {x: 0.2, y: 0.8}]})}>
                    <option value="zone_enter">Enters zone</option><option value="zone_exit">Exits zone</option><option value="dwell">Remains in zone</option><option value="line_cross">Crosses line</option>
                  </select>
                </Field>
                <Field label="Camera preview" hint="The rule applies to the workflow's connected camera input."><select value={previewCamera} onChange={(e) => setPreviewCamera(e.target.value)}>{data!.cameras.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
                {!regionImage && <p>No snapshot yet. Start monitoring this camera to obtain a preview, or draw using frame-relative coordinates.</p>}
                <p>Click to draw {draft.spatial.kind === "line_cross" ? "two line endpoints" : "a polygon (at least three corners)"}. Coordinates are relative to the full camera frame. The tracked object center is used.</p>
                <svg viewBox="0 0 100 100" role="img" aria-label="Draw workflow region" style={{width: "100%", height: 220, background: "#eef0f4", cursor: "crosshair"}} preserveAspectRatio="none" onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const points = draft.spatial!.points;
                  const max = draft.spatial!.kind === "line_cross" ? 2 : 12;
                  if (points.length >= max) return;
                  change("spatial", {...draft.spatial, points: [...points, {x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))}]});
                }}>
                  {regionImage && <image href={regionImage} x="0" y="0" width="100" height="100" preserveAspectRatio="none" />}
                  {draft.spatial.kind === "line_cross" ? <polyline points={draft.spatial.points.map(p => `${p.x * 100},${p.y * 100}`).join(" ")} stroke="#c00074" fill="none" strokeWidth="1" /> : <polygon points={draft.spatial.points.map(p => `${p.x * 100},${p.y * 100}`).join(" ")} stroke="#c00074" fill="#c0007420" strokeWidth="1" />}
                  {draft.spatial.points.map((p, i) => <circle key={i} cx={p.x * 100} cy={p.y * 100} r="1.5" fill="#c00074" />)}
                </svg>
                <Button onClick={() => change("spatial", {...draft.spatial, points: []})}>Redraw region</Button>
                <Button onClick={() => change("spatial", {...draft.spatial, points: draft.spatial!.points.slice(0, -1)})}>Undo point</Button>
                {draft.spatial.kind === "dwell" && <Field label="Seconds continuously inside"><input type="number" min={1} max={3600} value={draft.spatial.seconds || 30} onChange={(e) => change("spatial", {...draft.spatial, seconds: Number(e.target.value)})} /></Field>}
                {draft.spatial.kind === "line_cross" && <Field label="Crossing direction"><select value={draft.spatial.direction || "either"} onChange={(e) => change("spatial", {...draft.spatial, direction: e.target.value})}><option value="either">Either direction</option><option value="positive">{positiveDirection}</option><option value="negative">{negativeDirection}</option></select></Field>}
                <small>Use a live camera view to identify the region before drawing. Crossing direction follows the orientation of the drawn line. Geometry can be adjusted without cloud AI.</small>
              </div>
            )}
            {draft.ruleMode === "semantic" && (
              <div className="info-box">
                <Sparkles size={18} />
                <p>
                  Odin evaluates this description against an ordered sequence of
                  frames. Enable scene analysis in the camera viewer. A
                  connected AI provider is required.
                </p>
              </div>
            )}
            <Field
              label="Detection class"
              hint={
                draft.ruleMode === "semantic"
                  ? "Optional event category. Scene matching uses the description and AI evidence."
                  : "Rules match this class exactly using on-device detections."
              }
            >
              <select
                value={draft.detectionClass || "person"}
                onChange={(e) => change("detectionClass", e.target.value)}
              >
                {[...OBJECT_CLASSES, ...(draft.ruleMode === "spatial" ? [] : ["motion", "known_face", "unknown_face"]), "*"].map((c) => (
                  <option key={c} value={c}>
                    {c === "*" ? "Any event" : c.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </Field>
            <div className="info-box">
              <ScanLine size={18} />
              <p>
                Object rules use on-device detection. Face and motion rules
                require their switches enabled in the viewer.
              </p>
            </div>
          </>
        )}
        {node.type === "action" && (
          <>
            <Field label="Action">
              <select
                value={draft.action || "browser"}
                onChange={(e) => change("action", e.target.value)}
              >
                {Object.entries(actionNames).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            {["webhook", "mcp"].includes(draft.action || "") && (
              <Field label="Tool connection">
                <select
                  value={draft.integrationId || ""}
                  onChange={(e) => change("integrationId", e.target.value)}
                >
                  <option value="">Select a connection</option>
                  {data!.integrations
                    .filter((i) =>
                      draft.action === "mcp"
                        ? i.type === "mcp"
                        : ["webhook", "slack", "discord"].includes(i.type),
                    )
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                </select>
              </Field>
            )}
            {["email", "sms", "call", "mcp"].includes(draft.action || "") && (
              <Field
                label={
                  draft.action === "email"
                    ? "Recipient email"
                    : draft.action === "mcp"
                      ? "Tool name"
                      : "Recipient phone"
                }
                hint={
                  draft.action === "mcp"
                    ? "Use the exact name from the MCP server tool list."
                    : draft.action === "email"
                      ? "Requires a configured email provider."
                      : "Use E.164 format, e.g. +14155550123."
                }
              >
                <input
                  required
                  value={draft.destination || ""}
                  onChange={(e) => change("destination", e.target.value)}
                  type={draft.action === "email" ? "email" : "text"}
                />
              </Field>
            )}
            {draft.action === "mcp" && (
              <Field
                label="Tool arguments (JSON)"
                hint="Use {{message}} for the alert text. Arguments must match the tool schema."
              >
                <textarea
                  value={draft.toolArguments || '{"message":"{{message}}"}'}
                  onChange={(e) => change("toolArguments", e.target.value)}
                />
              </Field>
            )}
            <Field
              label="Cooldown (seconds)"
              hint="Prevents repeated alerts from the same action. Minimum 30 seconds."
            >
              <input
                type="number"
                min={30}
                max={86400}
                value={draft.cooldown || 60}
                onChange={(e) => change("cooldown", Number(e.target.value))}
              />
            </Field>
          </>
        )}
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <Button variant="danger" onClick={onDelete}>
            <Trash2 size={14} />
            Delete node
          </Button>
          <span className="spacer" />
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            <Check size={14} />
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function ExecutionHistory({ workflowId }: { workflowId?: string }) {
  const { data } = useOdin();
  const logs = [...data!.executions]
    .filter((e) => !workflowId || e.workflowId === workflowId)
    .sort((a, b) => b.timestamp - a.timestamp);
  return (
    <section className="surface execution-history">
      <div className="panel-title">
        <h2>
          <History size={16} />
          Execution history
        </h2>
        <Badge>{logs.length} runs</Badge>
      </div>
      {logs.length ? (
        <div className="execution-list">
          {logs.slice(0, 30).map((ex) => (
            <details key={ex.id}>
              <summary>
                <span className={`execution-dot ${ex.status}`} />
                <span>
                  <strong>{ex.workflowName}</strong>
                  <small>{ex.eventTitle}</small>
                </span>
                <Badge
                  tone={
                    ex.status === "success"
                      ? "lime"
                      : ex.status === "failed"
                        ? "critical"
                        : ex.status === "skipped" ? "neutral" : "warning"
                  }
                >
                  {ex.status}
                </Badge>
                <time>
                  {date(ex.timestamp)} · {time(ex.timestamp)}
                </time>
                <ChevronDown size={14} />
              </summary>
              <div className="execution-results">
                {ex.results.map((r) => (
                  <div key={r.nodeId}>
                    <Badge
                      tone={
                        r.status === "success"
                          ? "lime"
                          : r.status === "pending"
                            ? "orange"
                            : r.status === "skipped" ? "neutral" : "critical"
                      }
                    >
                      {r.status}
                    </Badge>
                    <strong>{actionNames[r.action] || r.action}</strong>
                    <p>{r.message}</p>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <Empty
          icon={History}
          title="The story starts with a detection"
          text="Activate a workflow and start a connected camera. Every action and its delivery status appears here."
        />
      )}
    </section>
  );
}
