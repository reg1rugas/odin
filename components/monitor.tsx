"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera as CameraIcon,
  Play,
  Square,
  ScanLine,
  Download,
  Maximize,
  Plus,
  TriangleAlert,
  Signal,
  Video,
  Pencil,
  Trash2,
  Eye,
  Activity,
  Sparkles,
  Webcam,
  Workflow,
  Mic,
  Volume2,
} from "lucide-react";
import { DemoOverlay } from "./demo-video";
import { WorkflowAlerts } from "./workflow-alerts";
import { useIncidentMonitor } from "./use-incident-monitor";
import { useOdin } from "./odin-context";
import { Button, Badge, Empty, Spinner, Modal, Toggle } from "./common";
import { CameraForm } from "./dashboard";
import { WorkflowEditor, ExecutionHistory } from "./workflows";
import { objectDetector, detectObjects, faceDetector, captureFrame } from "@/lib/inference";
import { submitTracks } from "@/lib/submit-tracks";
import { CameraTracker } from "@/lib/tracking";
import { queuedAnalysis } from "@/lib/analysis-queue";
import { demoTimeline } from "@/lib/demo";
import type { Camera, Event } from "@/lib/types";
const localCamera: Camera = {
  id: "local-webcam",
  name: "My Laptop Camera",
  location: "My Desk",
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
  const {
    data,
    api,
    persist,
    refresh,
    notify,
    deliver,
    navigate,
    seekTo,
    setSeekTo,
  } = odin;
  const [camera, setCamera] = useState<Camera>(
      initial ||
        data!.cameras.find((c) => c.source === "webcam") ||
        localCamera,
    ),
    [started, setStarted] = useState(false),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [modelState, setModelState] = useState(""),
    [objects, setObjects] = useState(!initial || initial.source !== "demo"),
    [faces, setFaces] = useState(live),
    [motion, setMotion] = useState(false),
    [predictions, setPredictions] = useState<any[]>([]),
    [currentTime, setCurrentTime] = useState(0),
    [continuous, setContinuous] = useState(false),
    [analyzing, setAnalyzing] = useState(false),
    [summary, setSummary] = useState(""),
    [edit, setEdit] = useState(false),
    [deleting, setDeleting] = useState(false),
    [recording, setRecording] = useState(false),
    [selectedFlow, setSelectedFlow] = useState(""),
    [autoNode, setAutoNode] = useState(true),
    [focusedEvent, setFocusedEvent] = useState<Event | null>(null),
    [frameRect, setFrameRect] = useState({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
    });
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    latest = useRef(odin),
    startedAt = useRef(Date.now()),
    generation = useRef(0),
    lastDetection = useRef<Record<string, number>>({}),
    tracker = useRef(new CameraTracker()),
    trackUpdates = useRef(new Map<string, number>()),
    previousSource = useRef(-1),
    captureSession = useRef(""),
    samples = useRef<{ image: string; at: number }[]>([]),
    recorder = useRef<MediaRecorder | null>(null),
    chunks = useRef<Blob[]>([]),
    previousPixels = useRef<Uint8ClampedArray | null>(null),
    analyzingRef = useRef(false);
  latest.current = odin;
  const demo = camera.source === "demo";
  const spatialRules = data!.workflows.filter(f => f.enabled && f.nodes.some(n => n.type === "input" && (!n.cameraId || n.cameraId === camera.id)))
    .flatMap(f => f.nodes.filter(n => n.type === "rule" && n.ruleMode === "spatial" && n.spatial).map(n => ({key: `${f.id}:${n.id}`, node: n})));
  const sourceTime = () =>
    camera.source === "webcam"
      ? (Date.now() - startedAt.current) / 1000
      : video.current?.currentTime || 0;
  const incident = useIncidentMonitor(video, camera, continuous && started && ready && !demo, sourceTime, () => captureSession.current);
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
    setContinuous(false);
    setPredictions([]);
    samples.current = [];
    setModelState("");
  }
  useEffect(
    () => () => {
      generation.current++;
      stream.current?.getTracks().forEach((t) => t.stop());
      if (recorder.current?.state === "recording") recorder.current.stop();
    },
    [],
  );
  useEffect(() => {
    if (initial && initial.id !== camera.id) {
      stop();
      setReady(false);
      setCamera(initial);
      setCurrentTime(0);
    }
  }, [initial?.id]);
  useEffect(() => {
    const element = video.current,
      stage = element?.parentElement;
    if (!element || !stage || !ready) return;
    const resize = () => {
      if (!element.videoWidth || !stage.clientWidth || !stage.clientHeight)
        return;
      const scale = Math.min(
          stage.clientWidth / element.videoWidth,
          stage.clientHeight / element.videoHeight,
        ),
        w = element.videoWidth * scale,
        h = element.videoHeight * scale;
      setFrameRect({
        left: ((stage.clientWidth - w) / 2 / stage.clientWidth) * 100,
        top: ((stage.clientHeight - h) / 2 / stage.clientHeight) * 100,
        width: (w / stage.clientWidth) * 100,
        height: (h / stage.clientHeight) * 100,
      });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    resize();
    return () => observer.disconnect();
  }, [ready, started]);
  useEffect(() => {
    if (demo && ready) {
      setStarted(true);
      void video.current?.play().catch(() => {});
    }
  }, [demo, ready, camera.id]);
  useEffect(() => {
    if (!seekTo || seekTo.cameraId !== camera.id || !ready || !video.current)
      return;
    video.current.currentTime = seekTo.time;
    setCurrentTime(seekTo.time);
    setStarted(true);
    void video.current.play().catch(() => {});
    setSeekTo(null);
  }, [seekTo, ready, camera.id]);
  async function start() {
    setBusy(true);
    setError("");
    const attempt = ++generation.current;
    try {
      if (camera.source === "webcam") {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error("Camera access requires HTTPS or localhost.");
        const s = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (attempt !== generation.current) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = s;
        video.current!.srcObject = s;
      }
      if (!demo && !data!.cameras.some((c) => c.id === camera.id))
        await persist("cameras", { ...camera, createdAt: Date.now() });
      if (attempt !== generation.current) return;
      startedAt.current = Date.now();
      captureSession.current = crypto.randomUUID();
      tracker.current = new CameraTracker();
      trackUpdates.current.clear();
      lastDetection.current = {};
      setStarted(true);
      await video.current?.play();
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop());
      setStarted(false);
      setError(
        (e as Error).name === "NotAllowedError"
          ? "Allow camera access in your browser, then try again."
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
    metadata: Partial<Event> = {},
  ) {
    const key = `${type}:${metadata.personId || metadata.trackId || ""}`;
    const now = Date.now();
    if (now - (lastDetection.current[key] || 0) < (metadata.trackId ? 5000 : 30000)) return;
    lastDetection.current[key] = now;
    try {
      let snapshot: string | undefined;
      try {
        snapshot = captureFrame(video.current!, 480);
      } catch {}
      const result = await latest.current.api("events", {
        cameraId: camera.id,
        sessionId: captureSession.current,
        type,
        confidence,
        title,
        description,
        severity: type === "unknown_face" ? "warning" : "info",
        sourceTime: sourceTime(),
        snapshot,
        ...metadata,
      });
      if (result.event?.matchedLocalRuleIds?.length) incident.trigger("Local workflow condition matched");
      await latest.current.deliver(result.executions || []);
      await latest.current.refresh();
    } catch (e) {
      latest.current.notify((e as Error).message, "error");
    }
  }
  useEffect(() => {
    if (!started || !ready || demo) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    let detector: any, human: any;
    async function scan() {
      if (!alive) return;
      const v = video.current;
      if (!v || v.paused || v.readyState < 2) {
        timer = setTimeout(scan, 1000);
        return;
      }
      try {
        const at = sourceTime();
        if (at < previousSource.current) {tracker.current.reset(); trackUpdates.current.clear(); previousPixels.current = null;}
        previousSource.current = at;
        const boxes: any[] = [];
        if (objects) {
          if (!detector) {
            setModelState("Loading object detection…");
            detector = await objectDetector();
            if (!alive) return;
          }
          const detected = tracker.current.update(
            await detectObjects(v, latest.current.data!.settings.confidence, latest.current.data!.settings.detectionQuality),
            camera.id, Date.now(), {width: v.videoWidth, height: v.videoHeight},
          );
          if (!alive) return;
          incident.note(detected, v.videoWidth, v.videoHeight);
          for (const p of detected) {
            if (!alive) return;
            boxes.push({
              ...p,
              label: `${p.class} #${p.trackId?.split("-").at(-1)} ${Math.round(p.score * 100)}%`,
            });

          }
        }
        if (objects) {
          const result = await submitTracks({detections: boxes, video: v, cameraId: camera.id, sourceTime: sourceTime(), sessionId: captureSession.current, last: trackUpdates.current, spatialRulesActive: latest.current.data!.workflows.some(f => f.enabled && f.nodes.some(n => n.type === "input" && (!n.cameraId || n.cameraId === camera.id)) && f.nodes.some(n => n.ruleMode === "spatial")), api: latest.current.api});
          if (result) {
            if (result.events.some(e => e.matchedLocalRuleIds?.length)) incident.trigger("Local workflow condition matched");
            await latest.current.deliver(result.executions); await latest.current.refresh();
          }
        }
        if (faces) {
          if (!human) {
            setModelState("Loading face recognition…");
            human = await faceDetector();
            if (!alive) return;
          }
          const result = await human.detect(v);
          if (!alive) return;
          for (const face of result.face || []) {
            if (!alive) return;
            let best = 0,
              person: any;
            for (const p of latest.current.data!.faces) {
              const score = human.match.similarity(face.embedding, p.embedding);
              if (score > best) {
                best = score;
                if (score >= 0.65) person = p;
              }
            }
            boxes.push({
              bbox: face.box,
              class: "face",
              label: person
                ? `${person.name} ${Math.round(best * 100)}%`
                : "Unknown",
              score: face.faceScore,
            });
            await recordEvent(
              person ? "known_face" : "unknown_face",
              person ? best : face.faceScore,
              person ? `${person.name} recognized` : "Unknown person detected",
              person
                ? "Face similarity matched an enrolled person. Verify the match before acting."
                : "No enrolled face matched above the similarity threshold.",
              person ? { personId: person.id, personName: person.name } : {},
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
          if (previousPixels.current) {
            let changed = 0;
            for (let i = 0; i < pixels.length; i += 4)
              if (
                Math.abs(pixels[i] - previousPixels.current[i]) +
                  Math.abs(pixels[i + 1] - previousPixels.current[i + 1]) +
                  Math.abs(pixels[i + 2] - previousPixels.current[i + 2]) >
                100
              )
                changed++;
            if (changed / 3072 > 0.12)
              await recordEvent(
                "motion",
                Math.min(1, changed / 1024),
                "Motion detected",
                "Movement exceeded the configured frame-difference threshold.",
              );
          }
          previousPixels.current = pixels;
        }
        if (alive) {
          setPredictions(
            boxes.map((p) => ({
              ...p,
              width: v.videoWidth,
              height: v.videoHeight,
            })),
          );
          setModelState("Detection active");
        }
      } catch (e) {
        if (alive) {
          setError((e as Error).message);
          setModelState("Detection update failed · retrying…");
        }
      }
      if (alive) timer = setTimeout(scan, 1000);
    }
    void scan();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [started, ready, objects, faces, motion, camera.id]);
  useEffect(() => {
    if (!started || !ready || demo) return;
    const sample = () => {
      if (video.current && !video.current.paused) {
        try {
          samples.current = [
            ...samples.current,
            { image: captureFrame(video.current, 480), at: sourceTime() },
          ].slice(-6);
        } catch {}
      }
    };
    sample();
    const t = setInterval(sample, 2000);
    return () => clearInterval(t);
  }, [started, ready, camera.id]);
  async function analyze() {
    if (analyzingRef.current) return;
    analyzingRef.current = true;
    setAnalyzing(true);
    try {
      const frames = samples.current.length
        ? [...samples.current]
        : [{ image: captureFrame(video.current!, 480), at: sourceTime() }];
      const result = await queuedAnalysis(() =>
        latest.current.api("analyze", {
          cameraId: camera.id,
          frames,
          sessionId: captureSession.current,
          sourceTime: sourceTime(),
        }),
      );
      setSummary(result.summary);
      await latest.current.deliver(result.executions || []);
      await latest.current.refresh();
    } catch (e) {
      setError((e as Error).message);
      latest.current.notify((e as Error).message, "error");
    } finally {
      setAnalyzing(false);
      analyzingRef.current = false;
    }
  }
  function snapshot() {
    try {
      const a = document.createElement("a");
      a.href = captureFrame(video.current!);
      a.download = `odin-${Date.now()}.jpg`;
      a.click();
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
        throw new Error(
          "Recording is available for webcam streams. Uploaded videos are already saved.",
        );
      chunks.current = [];
      recorder.current = new MediaRecorder(stream.current);
      recorder.current.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      recorder.current.onstop = () => {
        const type = recorder.current?.mimeType || "video/webm";
        const uri = URL.createObjectURL(new Blob(chunks.current, { type }));
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
  const allEvents = demo
    ? demoTimeline(camera.id)
    : data!.events
        .filter((e) => e.cameraId === camera.id && !e.demo)
        .sort(
          (a, b) =>
            (a.sourceTime ?? 0) - (b.sourceTime ?? 0) ||
            a.timestamp - b.timestamp,
        );
  const visibleEvents =
    demo || camera.source === "upload"
      ? allEvents.filter((e) => (e.sourceTime ?? 0) <= currentTime + 0.2)
      : allEvents;
  const flows = data!.workflows.filter((f) =>
    f.nodes.some((n) => n.type === "input" && n.cameraId === camera.id),
  );
  const flow =
    flows.find((f) => f.id === selectedFlow) ||
    flows.find((f) => f.id.startsWith("demo-flow-")) ||
    flows[0];
  const activeEvent = autoNode ? focusedEvent || visibleEvents.at(-1) : null;
  const previewEvent =
    activeEvent && demo && flow
      ? {
          ...activeEvent,
          matchedRuleIds: flow.nodes
            .filter(
              (n) => n.type === "rule" && n.detectionClass === activeEvent.type,
            )
            .map((n) => n.id),
        }
      : activeEvent;
  function chooseEvent(event: Event) {
    setFocusedEvent(event);
    if (
      event.sourceTime !== undefined &&
      video.current &&
      camera.source !== "webcam"
    ) {
      video.current.currentTime = event.sourceTime;
      setCurrentTime(event.sourceTime);
    }
    if (!demo) onEvent(event.id);
  }
  return (
    <div className="classic-monitor">
      {!live && (
        <button className="back-link" onClick={onBack}>
          <ArrowLeft size={13} />
          Cameras
        </button>
      )}
      <div className="classic-heading">
        <div>
          <h1>{live ? "Live Viewer" : camera.name}</h1>
          <p>
            {live
              ? "Monitor your camera feed with workflow automation"
              : camera.location}
          </p>
        </div>
        <div>
          {live && (
            <select
              aria-label="Select live camera"
              value={camera.id}
              onChange={(e) => {
                stop();
                setReady(false);
                setCamera(
                  data!.cameras.find((c) => c.id === e.target.value) ||
                    localCamera,
                );
                setFocusedEvent(null);
                setError("");
              }}
            >
              <option value="local-webcam">My Laptop Camera</option>
              {data!.cameras
                .filter((c) => c.id !== "local-webcam")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          )}
          {!live && (
            <>
              <Button onClick={() => setEdit(true)}>
                <Pencil size={13} />
                Edit
              </Button>
              <button
                className="icon-btn"
                aria-label="Remove camera"
                onClick={() => setDeleting(true)}
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      </div>
      <div className="monitor-grid">
        <section className="surface viewer-panel">
          <div className="panel-title">
            <h2>
              <Video size={15} />
              {camera.name} <small>{camera.location}</small>
            </h2>
            <Badge tone={started ? "lime" : "neutral"}>
              <Signal size={11} />
              {demo ? "Recorded demo" : started ? "Live" : "Stopped"}
            </Badge>
          </div>
          <div className={`video-stage ${started ? "started" : ""}`}>
            <video
              ref={video}
              src={
                camera.source !== "webcam" ? camera.url || undefined : undefined
              }
              poster={camera.thumbnail || undefined}
              crossOrigin="anonymous"
              muted
              playsInline
              controls={camera.source !== "webcam"}
              loop={demo}
              onLoadedData={() => setReady(true)}
              onSeeking={() => {
                samples.current = [];
              }}
              onPlay={() => {
                setStarted(true);
                setFocusedEvent(null);
              }}
              onTimeUpdate={() =>
                setCurrentTime(video.current?.currentTime || 0)
              }
              onError={() =>
                setError(
                  "Video could not load. Check the URL, format, and CORS policy.",
                )
              }
            />
            {!started && !demo && (
              <div className="video-placeholder">
                <div className="video-placeholder-icon">
                  <Webcam size={34} />
                </div>
                <h3>
                  {camera.source === "webcam"
                    ? "Connect your camera"
                    : "Video monitoring"}
                </h3>
                <p>
                  {camera.source === "webcam"
                    ? "Camera access stays under your control."
                    : "Play this video to analyze it and build an event timeline."}
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
                      <Play size={14} />
                      Start monitoring
                    </>
                  )}
                </Button>
              </div>
            )}
            {demo && <DemoOverlay cameraId={camera.id} videoRef={video} />}
            {started && !demo && (
              <div
                className="detection-layer"
                style={{
                  inset: "auto",
                  left: `${frameRect.left}%`,
                  top: `${frameRect.top}%`,
                  width: `${frameRect.width}%`,
                  height: `${frameRect.height}%`,
                }}
              >
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Active workflow regions and tracked object centers" style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}>
                  {spatialRules.map(({key,node}) => node.spatial!.kind === "line_cross"
                    ? <polyline key={key} points={node.spatial!.points.map(p => `${p.x*100},${p.y*100}`).join(" ")} fill="none" stroke="#ffcf33" strokeWidth="2" vectorEffect="non-scaling-stroke"><title>{node.title} · line crossing</title></polyline>
                    : <polygon key={key} points={node.spatial!.points.map(p => `${p.x*100},${p.y*100}`).join(" ")} fill="#ffcf3318" stroke="#ffcf33" strokeWidth="2" vectorEffect="non-scaling-stroke"><title>{node.title} · {node.spatial!.kind}</title></polygon>)}
                  {predictions.filter(p => p.trackId).map(p => <circle key={p.trackId} cx={(p.bbox[0]+p.bbox[2]/2)/p.width*100} cy={(p.bbox[1]+p.bbox[3]/2)/p.height*100} r="0.7" fill="#00ffff" />)}
                </svg>
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
            )}
          </div>
          <div className="video-controls">
            <div>
              {started ? (
                <Button variant="danger" onClick={stop}>
                  <Square size={12} />
                  Stop
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={() => void start()}
                  disabled={busy}
                >
                  <Play size={13} />
                  Start
                </Button>
              )}
              <span className="muted">
                {demo
                  ? "Recorded detections + scripted events · no outbound actions"
                  : recording
                    ? "Recording…"
                    : modelState || "Ready"}
              </span>
            </div>
            <div>
              <button
                className="icon-btn"
                title="Download snapshot"
                disabled={!ready}
                onClick={snapshot}
              >
                <CameraIcon size={16} />
              </button>
              <button
                className={`icon-btn ${recording ? "text-red" : ""}`}
                title="Record webcam clip"
                disabled={!started || !stream.current}
                onClick={toggleRecording}
              >
                <Video size={16} />
              </button>
              <button
                className="icon-btn"
                title="Fullscreen video"
                onClick={() =>
                  void video.current?.parentElement?.requestFullscreen?.()
                }
              >
                <Maximize size={16} />
              </button>
            </div>
          </div>
          {!demo && (
            <>
              <div className="detection-settings">
                <span>
                  <ScanLine size={15} />
                  On-device detection
                </span>
                <label>
                  <input
                    type="checkbox"
                    checked={objects}
                    onChange={(e) => setObjects(e.target.checked)}
                  />
                  Objects
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={faces}
                    onChange={(e) => setFaces(e.target.checked)}
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
              </div>
              <div className="ai-analyze-toolbar">
                <div>
                  <Sparkles size={15} />
                  Scene analysis
                </div>
                <label>
                  <input
                    type="checkbox"
                    checked={continuous}
                    disabled={
                      !started || !(odin.aiKey || data!.capabilities.ai)
                    }
                    onChange={(e) => setContinuous(e.target.checked)}
                  />
                  Incident clips
                </label>
                <small>10s pre-buffer · 10–30s activity · hourly limit {data!.settings.aiChecksPerHour ?? 12}</small>
                <Button
                  disabled={!started || analyzing}
                  onClick={() => void analyze()}
                >
                  {analyzing ? (
                    <Spinner text="Analyzing…" />
                  ) : (
                    "Analyze sequence"
                  )}
                </Button>
              </div>
            </>
          )}
          {started && !demo && <p className="muted">{!objects ? "Enable object detection to evaluate line and zone rules." : spatialRules.length ? `${spatialRules.length} active spatial rules · yellow regions, cyan object centers. Crossing and exit use the center, not the box edge.` : "No active line or zone rules for this camera. Save and enable a connected workflow to activate them."}</p>}
          {demo ? <p className="analysis-summary">Recorded boxes and scripted events preview the workflow graph. Demo playback never sends alerts. Connect your own camera or upload footage to run live detection and automation.</p> : <WorkflowAlerts cameraIds={[camera.id]} />}
          {error && (
            <div className="inline-error">
              <TriangleAlert size={15} />
              {error}
            </div>
          )}
          {continuous && incident.status && <p className="analysis-summary" role="status">{incident.status}</p>}
          {summary && (
            <div className="analysis-summary">
              <Badge tone="purple">Scene understanding</Badge>
              <p>{summary}</p>
            </div>
          )}
        </section>
        <aside className="surface live-events">
          <div className="panel-title">
            <h2>
              <Activity size={16} />
              {live ? "Live Events" : "Video Events"}
            </h2>
            <Badge>{visibleEvents.length}</Badge>
          </div>
          <div className="video-events-list">
            {visibleEvents.length ? (
              visibleEvents.map((event) => (
                <button
                  key={event.id}
                  className={`video-event ${event.severity} ${activeEvent?.id === event.id ? "current" : ""}`}
                  onClick={() => chooseEvent(event)}
                >
                  <span>
                    {event.sourceTime !== undefined
                      ? formatOffset(event.sourceTime)
                      : new Date(event.timestamp).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                  </span>
                  <i />
                  <p>{event.description}</p>
                  {event.personName && <small>{event.personName}</small>}
                </button>
              ))
            ) : (
              <p className="events-waiting">
                {demo
                  ? "No events reached yet — play the video to see events."
                  : "Start monitoring to capture events. Enable scene analysis for semantic rules."}
              </p>
            )}
          </div>
          {demo && (
            <div className="demo-timeline">
              <span>Demo timeline</span>
              {allEvents.map((e) => (
                <button
                  key={e.id}
                  title={e.title}
                  onClick={() => {
                    if (video.current) {
                      video.current.currentTime = e.sourceTime || 0;
                      setCurrentTime(e.sourceTime || 0);
                      void video.current.play();
                    }
                  }}
                >
                  {formatOffset(e.sourceTime || 0)}
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>
      <section className="surface monitor-workflow">
        <div className="panel-title">
          <h2>
            <Workflow size={16} />
            Workflow Graph
          </h2>
          <div>
            {flows.length > 1 && (
              <select
                aria-label="Camera workflow"
                value={flow?.id || ""}
                onChange={(e) => setSelectedFlow(e.target.value)}
              >
                {flows.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            )}
            <Button onClick={() => navigate("workflows", flow?.id)}>
              {flow ? "Open workflow" : "Create workflow"}
              <Plus size={13} />
            </Button>
          </div>
        </div>
        {flow ? (
          <WorkflowEditor
            key={flow.id}
            initial={flow}
            compact
            activeEvent={previewEvent || undefined}
          />
        ) : (
          <Empty
            icon={Workflow}
            title="No workflow configured"
            text="Create a workflow and connect this camera to a rule and an action."
            action={
              <Button onClick={() => navigate("workflows")}>
                <Plus size={14} />
                Create workflow
              </Button>
            }
          />
        )}
      </section>
      <section className="surface workflow-executor">
        <div className="panel-title">
          <h2>
            <Sparkles size={15} />
            Workflow Executor <span className="status-dot" />
          </h2>
          <div>
            <label>
              <input
                type="checkbox"
                checked={autoNode}
                onChange={(e) => setAutoNode(e.target.checked)}
              />
              Auto node
            </label>
            <Button
              onClick={() => {
                setAutoNode(false);
                setFocusedEvent(null);
              }}
            >
              Clear highlight
            </Button>
          </div>
        </div>
        {previewEvent ? (
          <div className="executor-observation">
            <Badge tone={demo ? "neutral" : "lime"}>
              {demo
                ? "Demo preview · no actions sent"
                : previewEvent.origin === "ai"
                  ? "AI observation"
                  : "Local detection"}
            </Badge>
            <p>{previewEvent.description}</p>
            <small>
              {demo ? "Scripted event · recorded object boxes" : <>{previewEvent.matchedRuleIds?.length || 0} semantic rule matches · {Math.round(previewEvent.confidence * 100)}% reported confidence</>}
            </small>
          </div>
        ) : (
          <p className="events-waiting">
            Events appear here as the video plays. Matched graph nodes light up
            automatically.
          </p>
        )}
      </section>
      {!demo && flow && <ExecutionHistory workflowId={flow.id} />}
      {edit && <CameraForm camera={camera} onClose={() => setEdit(false)} />}
      {deleting && (
        <Modal
          title="Remove this camera?"
          subtitle="Its saved events and uploaded video will be removed."
          onClose={() => setDeleting(false)}
        >
          <div className="modal-actions">
            <Button onClick={() => setDeleting(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                try {
                  stop();
                  await odin.remove("cameras", camera.id);
                  navigate("cameras");
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
    </div>
  );
}
function formatOffset(n: number) {
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
}
