"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Radio,
  Camera as CameraIcon,
  Play,
  Square,
  ScanLine,
  Volume2,
  Download,
  Maximize,
  Settings2,
  Plus,
  TriangleAlert,
  Signal,
  Video,
  Mic,
  Pause,
  Pencil,
  Trash2,
  Eye,
  Activity,
  Sparkles,
  Webcam,
  Check,
  Workflow,
  RefreshCw,
} from "lucide-react";
import { useOdin } from "./odin-context";
import {
  Button,
  PageHeading,
  Badge,
  EventRow,
  Empty,
  Spinner,
  Modal,
  Toggle,
} from "./common";
import { CameraForm } from "./dashboard";
import { WorkflowEditor } from "./workflows";
import { objectDetector, faceDetector, captureFrame } from "@/lib/inference";
import type { Camera, Event } from "@/lib/types";
const localCamera: Camera = {
  id: "local-webcam",
  name: "My device camera",
  location: "This device",
  category: "Office",
  source: "webcam",
  url: "",
  thumbnail: "",
  status: "online",
  enabled: true,
  createdAt: 0,
};
export function Monitor({
  camera: initial,
  live = false,
  onBack,
  onEvent,
}: {
  camera?: Camera;
  live?: boolean;
  onBack?: () => void;
  onEvent: (id: string) => void;
}) {
  const odin = useOdin();
  const { data, api, persist, refresh, notify, deliver, navigate } = odin;
  const [camera, setCamera] = useState<Camera>(
      initial ||
        data!.cameras.find((c) => c.source === "webcam") ||
        localCamera,
    ),
    [started, setStarted] = useState(false),
    [busy, setBusy] = useState(false),
    [modelState, setModelState] = useState(""),
    [error, setError] = useState(""),
    [objects, setObjects] = useState(true),
    [faces, setFaces] = useState(false),
    [motion, setMotion] = useState(false),
    [predictions, setPredictions] = useState<any[]>([]),
    [recording, setRecording] = useState(false),
    [edit, setEdit] = useState(false),
    [deleting, setDeleting] = useState(false),
    [analyzing, setAnalyzing] = useState(false),
    [summary, setSummary] = useState(""),
    [continuous, setContinuous] = useState(false),
    [selectedFlow, setSelectedFlow] = useState(""),
    [ready, setReady] = useState(false);
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    recorder = useRef<MediaRecorder | null>(null),
    chunks = useRef<Blob[]>([]),
    lastDetection = useRef<Record<string, number>>({}),
    latest = useRef(odin),
    motionFrame = useRef<Uint8ClampedArray | null>(null),
    inferenceError = useRef(false),
    generation = useRef(0);
  latest.current = odin;
  useEffect(() => {
    if (initial) {
      stop();
      setCamera(initial);
    }
  }, [initial?.id]);
  useEffect(
    () => () => {
      generation.current++;
      stream.current?.getTracks().forEach((t) => t.stop());
      if (recorder.current?.state === "recording") recorder.current.stop();
    },
    [],
  );
  function stop() {
    generation.current++;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
    if (video.current) {
      video.current.pause();
      video.current.srcObject = null;
    }
    setStarted(false);
    setReady(false);
    setPredictions([]);
    setContinuous(false);
    setModelState("");
  }
  async function start() {
    setBusy(true);
    setError("");
    const attempt = ++generation.current;
    try {
      if (camera.source === "demo") {
        setError(
          "This is a labeled sample preview. Connect a webcam, video file, or stream to monitor real activity.",
        );
        return;
      }
      if (camera.source === "webcam") {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error(
            "Camera access requires HTTPS or localhost in a supported browser.",
          );
        const s = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (attempt !== generation.current) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = s;
        if (video.current) video.current.srcObject = s;
      }
      if (!data!.cameras.find((c) => c.id === camera.id)) {
        await persist("cameras", { ...camera, createdAt: Date.now() });
      }
      if (attempt !== generation.current) return;
      setStarted(true);
      inferenceError.current = false;
      await video.current?.play();
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
      setStarted(false);
      setError(
        (e as Error).name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access in your browser and try again."
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  async function recordEvent(
    type: string,
    confidence: number,
    title: string,
    description: string,
  ) {
    const now = Date.now();
    if (now - (lastDetection.current[type] || 0) < 30000) return;
    lastDetection.current[type] = now;
    try {
      const result = await latest.current.api("events", {
        cameraId: camera.id,
        type,
        confidence,
        title,
        description,
        severity: type === "unknown_face" ? "warning" : "info",
      });
      await latest.current.deliver(result.executions || []);
      await latest.current.refresh();
    } catch (e) {
      latest.current.notify((e as Error).message, "error");
    }
  }
  useEffect(() => {
    if (!started || !ready || camera.source === "demo") return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    let detector: any, human: any;
    async function scan() {
      if (
        !alive ||
        !video.current ||
        video.current.paused ||
        video.current.readyState < 2
      ) {
        if (alive) timer = setTimeout(scan, 1000);
        return;
      }
      try {
        const v = video.current;
        const boxes: any[] = [];
        if (objects) {
          if (!detector) {
            setModelState("Loading object detection…");
            detector = await objectDetector();
            if (!alive) return;
            setModelState("Object detection ready");
          }
          const found = await detector.detect(
            v,
            15,
            latest.current.data!.settings.confidence,
          );
          if (!alive) return;
          for (const p of found) {
            boxes.push({
              ...p,
              label: `${p.class} ${Math.round(p.score * 100)}%`,
            });
            await recordEvent(
              p.class,
              p.score,
              `${p.class.charAt(0).toUpperCase() + p.class.slice(1)} detected`,
              `${p.class} observed by browser object detection in ${camera.name}.`,
            );
          }
        }
        if (faces) {
          if (!human) {
            setModelState("Loading face recognition…");
            human = await faceDetector();
            if (!alive) return;
            setModelState("Face recognition ready");
          }
          const result = await human.detect(v);
          if (!alive) return;
          for (const face of result.face || []) {
            const known = latest.current.data!.faces;
            let name = "Unknown face",
              best = 0;
            for (const p of known) {
              const score = human.match.similarity(face.embedding, p.embedding);
              if (score > best) {
                best = score;
                if (score >= 0.65) name = p.name;
              }
            }
            const recognized = best >= 0.65;
            boxes.push({
              bbox: face.box,
              score: face.faceScore,
              label: recognized
                ? `${name} ${Math.round(best * 100)}%`
                : "Unknown face",
              class: "face",
            });
            await recordEvent(
              recognized ? "known_face" : "unknown_face",
              recognized ? best : face.faceScore,
              recognized ? `${name} recognized` : "Unknown face detected",
              recognized
                ? "Matched an enrolled face in your private directory."
                : "No enrolled face matched above the similarity threshold.",
            );
          }
        }
        if (motion) {
          const c = document.createElement("canvas");
          c.width = 64;
          c.height = 48;
          const ctx = c.getContext("2d")!;
          ctx.drawImage(v, 0, 0, 64, 48);
          const pixels = ctx.getImageData(0, 0, 64, 48).data;
          if (motionFrame.current) {
            let changed = 0;
            for (let i = 0; i < pixels.length; i += 4) {
              if (
                Math.abs(pixels[i] - motionFrame.current[i]) +
                  Math.abs(pixels[i + 1] - motionFrame.current[i + 1]) +
                  Math.abs(pixels[i + 2] - motionFrame.current[i + 2]) >
                100
              )
                changed++;
            }
            if (changed / (64 * 48) > 0.12)
              await recordEvent(
                "motion",
                Math.min(1, (changed / (64 * 48)) * 3),
                "Motion detected",
                "Frame differences exceeded the movement threshold.",
              );
          }
          motionFrame.current = pixels;
        }
        if (alive)
          setPredictions(
            boxes.map((p) => ({
              ...p,
              width: v.videoWidth,
              height: v.videoHeight,
            })),
          );
      } catch (e) {
        if (alive && !inferenceError.current) {
          setError((e as Error).message);
          setModelState("Detection paused — check connection or source CORS");
          inferenceError.current = true;
        }
        return;
      }
      if (alive) timer = setTimeout(scan, 1000);
    }
    void scan();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [started, ready, objects, faces, motion, camera.id]);
  async function analyze() {
    if (analyzing) return;
    setAnalyzing(true);
    try {
      const image = captureFrame(video.current!);
      const result = await api("analyze", { image, cameraId: camera.id });
      setSummary(result.summary);
      await deliver(result.executions || []);
      await refresh();
      notify("Frame analysis complete");
    } catch (e) {
      notify((e as Error).message, "error");
      setContinuous(false);
    } finally {
      setAnalyzing(false);
    }
  }
  useEffect(() => {
    if (!continuous || !started) return;
    const timer = setInterval(() => void analyze(), 15000);
    return () => clearInterval(timer);
  }, [continuous, started, analyzing]);
  function snapshot() {
    try {
      const uri = captureFrame(video.current!);
      const a = document.createElement("a");
      a.href = uri;
      a.download = `odin-${Date.now()}.jpg`;
      a.click();
      notify("Snapshot downloaded");
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }
  function toggleRecording() {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    try {
      if (!stream.current)
        throw new Error("Recording is available for webcam feeds.");
      chunks.current = [];
      recorder.current = new MediaRecorder(stream.current);
      recorder.current.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      recorder.current.onstop = () => {
        const type = recorder.current?.mimeType || "video/webm";
        const blob = new Blob(chunks.current, { type });
        const uri = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = uri;
        a.download = `odin-recording-${Date.now()}.${type.includes("mp4") ? "mp4" : "webm"}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(uri), 1000);
        setRecording(false);
      };
      recorder.current.start(1000);
      setRecording(true);
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }
  const events = [...data!.events]
    .filter((e) => e.cameraId === camera.id)
    .sort((a, b) => b.timestamp - a.timestamp);
  const flows = data!.workflows.filter((f) =>
    f.nodes.some((n) => n.type === "input" && n.cameraId === camera.id),
  );
  const flow = flows.find((f) => f.id === selectedFlow) || flows[0];
  return (
    <>
      {!live && (
        <button className="back-link" onClick={onBack}>
          <ArrowLeft size={14} />
          All cameras
        </button>
      )}
      <PageHeading
        eyebrow={live ? "IN THE MOMENT" : "CAMERA INTELLIGENCE"}
        title={live ? "Live viewer" : camera.name}
        description={
          live
            ? "Real-time awareness, powered by your device."
            : `${camera.location} · ${camera.category}`
        }
      >
        <Badge tone={started ? "lime" : "neutral"}>
          <span className={`status-dot ${started ? "" : "gray"}`} />
          {started ? "Monitoring" : "Not monitoring"}
        </Badge>
        {!live && (
          <Button onClick={() => setEdit(true)}>
            <Pencil size={14} />
            Edit camera
          </Button>
        )}
        {!live && (
          <Button
            variant="ghost"
            onClick={() => setDeleting(true)}
            title="Remove camera"
          >
            <Trash2 size={16} />
          </Button>
        )}
      </PageHeading>
      {live && (
        <div className="monitor-select">
          <CameraIcon size={16} />
          <select
            aria-label="Select live camera"
            value={camera.id}
            onChange={(e) => {
              stop();
              setCamera(
                data!.cameras.find((c) => c.id === e.target.value) ||
                  localCamera,
              );
              setError("");
            }}
          >
            <option value="local-webcam">My device camera</option>
            {data!.cameras
              .filter((c) => c.id !== "local-webcam")
              .map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                  {c.source === "demo" ? " (sample)" : ""}
                </option>
              ))}
          </select>
          <span className="muted">
            Browser detection processes frames on this device
          </span>
        </div>
      )}
      <div className="monitor-grid">
        <section className="surface viewer-panel">
          <div className="panel-title">
            <h2>
              <Video size={16} />
              {camera.name}
            </h2>
            <span className="muted">
              <Signal size={13} />
              {camera.source === "demo"
                ? "Sample source"
                : camera.source === "webcam"
                  ? "Device camera"
                  : "Video source"}
            </span>
          </div>
          <div className={`video-stage ${started ? "started" : ""}`}>
            <video
              ref={video}
              crossOrigin="anonymous"
              src={
                camera.source !== "webcam" && camera.source !== "demo"
                  ? camera.url
                  : undefined
              }
              muted
              playsInline
              loop={camera.source === "upload"}
              onLoadedData={() => setReady(true)}
              onError={() => {
                setError(
                  "The video could not load. Check its URL, format, and CORS policy.",
                );
                setStarted(false);
              }}
              controls={started && camera.source !== "webcam"}
            />
            {camera.source === "demo" ? (
              <>
                <img
                  src={camera.thumbnail}
                  alt={`${camera.name} sample preview`}
                />
                <div className="sample-preview-notice">
                  <Eye size={26} />
                  <h3>Sample camera preview</h3>
                  <p>Connect your own feed to enable live monitoring.</p>
                  <Button onClick={() => navigate("live")}>
                    Try your webcam <ArrowUpRight size={14} />
                  </Button>
                </div>
              </>
            ) : (
              !started && (
                <div className="video-placeholder">
                  <div className="video-placeholder-icon">
                    <Webcam size={36} />
                  </div>
                  <h3>Your next perspective</h3>
                  <p>
                    {camera.source === "webcam"
                      ? "Start your camera to see what Odin sees."
                      : "Start monitoring to play and analyze this video."}
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => void start()}
                    disabled={busy}
                  >
                    {busy ? (
                      <Spinner text="Connecting…" />
                    ) : (
                      <>
                        <Play size={15} />
                        Start monitoring
                      </>
                    )}
                  </Button>
                  <small>
                    <ShieldCheckIcon />
                    Camera frames stay on this device unless you use AI
                    analysis.
                  </small>
                </div>
              )
            )}
            {started && (
              <>
                <div className="video-live-label">
                  <span />
                  LIVE MONITORING
                </div>
                <div className="detection-layer">
                  {predictions.map((p, i) => (
                    <div
                      className={`live-box ${p.class === "face" ? "face" : ""}`}
                      key={i}
                      style={{
                        left: `${(p.bbox[0] / p.width) * 100}%`,
                        top: `${(p.bbox[1] / p.height) * 100}%`,
                        width: `${(p.bbox[2] / p.width) * 100}%`,
                        height: `${(p.bbox[3] / p.height) * 100}%`,
                      }}
                    >
                      <span>{p.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="video-controls">
            <div>
              {started ? (
                <Button variant="danger" onClick={stop}>
                  <Square size={13} />
                  Stop
                </Button>
              ) : camera.source !== "demo" ? (
                <Button
                  variant="primary"
                  onClick={() => void start()}
                  disabled={busy}
                >
                  <Play size={14} />
                  Start
                </Button>
              ) : (
                <Badge>Demo mode</Badge>
              )}
              <span className="muted">
                {recording ? (
                  <span className="recording">
                    <span />
                    Recording
                  </span>
                ) : (
                  modelState || "Ready when you are"
                )}
              </span>
            </div>
            <div>
              <button
                className="icon-btn"
                title="Download snapshot"
                disabled={!started}
                onClick={snapshot}
              >
                <CameraIcon size={17} />
              </button>
              <button
                className={`icon-btn ${recording ? "text-red" : ""}`}
                title="Record webcam clip"
                disabled={!started || camera.source !== "webcam"}
                onClick={toggleRecording}
              >
                <Video size={17} />
              </button>
              <button
                className="icon-btn"
                title="Fullscreen video"
                onClick={() =>
                  void video.current?.parentElement?.requestFullscreen?.()
                }
              >
                <Maximize size={17} />
              </button>
            </div>
          </div>
          {error && (
            <div className="inline-error">
              <TriangleAlert size={16} />
              {error}
            </div>
          )}
          <div className="detection-settings">
            <span>
              <ScanLine size={15} />
              Detection
            </span>
            <label>
              <input
                type="checkbox"
                checked={objects}
                onChange={(e) => {
                  setObjects(e.target.checked);
                  inferenceError.current = false;
                }}
              />
              Objects
            </label>
            <label>
              <input
                type="checkbox"
                checked={faces}
                onChange={(e) => {
                  setFaces(e.target.checked);
                  inferenceError.current = false;
                }}
              />
              Faces
            </label>
            <label>
              <input
                type="checkbox"
                checked={motion}
                onChange={(e) => setMotion(e.target.checked)}
              />
              Motion
            </label>
            <Badge>
              {Math.round(data!.settings.confidence * 100)}% threshold
            </Badge>
          </div>
          <div className="ai-analyze-toolbar">
            <div>
              <Sparkles size={16} />
              <span>Visual reasoning</span>
            </div>
            <label>
              <input
                type="checkbox"
                checked={continuous}
                disabled={!started || !(odin.aiKey || data!.capabilities.ai)}
                onChange={(e) => setContinuous(e.target.checked)}
              />
              Every 15 seconds
            </label>
            <Button
              disabled={!started || analyzing}
              onClick={() => void analyze()}
            >
              {analyzing ? (
                <Spinner text="Analyzing…" />
              ) : (
                <>
                  Analyze frame
                  <ArrowUpRight size={14} />
                </>
              )}
            </Button>
          </div>
          {summary && (
            <div className="analysis-summary">
              <Badge tone="purple">FRAME INSIGHT</Badge>
              <p>{summary}</p>
            </div>
          )}
        </section>
        <aside className="surface live-events">
          <div className="panel-title">
            <h2>
              <Activity size={16} />
              Camera events
            </h2>
            <Badge>{events.length}</Badge>
          </div>
          <p className="panel-subtitle">Observations, as they happen.</p>
          <div className="live-event-scroll">
            {events.length ? (
              events
                .slice(0, 30)
                .map((e) => (
                  <EventRow
                    compact
                    key={e.id}
                    event={e}
                    camera={camera}
                    onClick={() => onEvent(e.id)}
                  />
                ))
            ) : (
              <Empty
                icon={ScanLine}
                title="Watching for moments"
                text="Start monitoring to capture your first detection."
              />
            )}
          </div>
        </aside>
      </div>
      <section className="surface monitor-workflow">
        <div className="panel-title">
          <h2>
            <Workflow size={17} />
            Camera workflow
          </h2>
          <div>
            {flows.length > 1 && (
              <select
                value={flow?.id}
                onChange={(e) => setSelectedFlow(e.target.value)}
              >
                {flows.map((f) => (
                  <option value={f.id} key={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            )}
            <Button onClick={() => navigate("workflows", flow?.id)}>
              {flow ? "Open editor" : "Build workflow"}
              <ArrowUpRight size={14} />
            </Button>
          </div>
        </div>
        {flow ? (
          <WorkflowEditor key={flow.id} initial={flow} compact />
        ) : (
          <Empty
            icon={Workflow}
            title="Give this camera a purpose"
            text="Connect detections to actions with a visual workflow."
            action={
              <Button onClick={() => navigate("workflows")}>
                <Plus size={15} />
                Create workflow
              </Button>
            }
          />
        )}
      </section>
      {edit && (
        <CameraForm
          camera={camera}
          onClose={() => {
            setEdit(false);
            void refresh();
          }}
        />
      )}
      {deleting && (
        <Modal
          title="Remove this camera?"
          subtitle="Its camera record, event history, and uploaded video will be removed."
          onClose={() => setDeleting(false)}
        >
          <p className="muted">
            Workflows that reference this camera will need a new camera input.
          </p>
          <div className="modal-actions">
            <Button onClick={() => setDeleting(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                try {
                  stop();
                  await odin.remove("cameras", camera.id);
                  navigate("cameras");
                  notify("Camera removed");
                } catch (e) {
                  notify((e as Error).message, "error");
                }
              }}
            >
              Remove camera
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
function ShieldCheckIcon() {
  return <Eye size={12} />;
}
