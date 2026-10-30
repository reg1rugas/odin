"use client";
import { useEffect, useRef, useState } from "react";
import {
  Radio,
  Square,
  Camera as CameraIcon,
  Plus,
  Video,
  ScanFace,
  Sparkles,
  X,
  Maximize,
  Activity,
} from "lucide-react";
import { useOdin } from "./odin-context";
import { Button, Modal, Badge, Empty } from "./common";
import { detectObjects, faceDetector, captureFrame } from "@/lib/inference";
import { submitTracks } from "@/lib/submit-tracks";
import { CameraTracker } from "@/lib/tracking";
import { WorkflowAlerts } from "./workflow-alerts";
import { useIncidentMonitor } from "./use-incident-monitor";
import type { Camera } from "@/lib/types";
let perception: Promise<unknown> = Promise.resolve();
function serial<T>(work: () => Promise<T>): Promise<T> {
  const next = perception.then(work, work);
  perception = next.catch(() => {});
  return next;
}
export function MonitoringSession() {
  const odin = useOdin();
  const {
    data,
    monitoringIds,
    setMonitoringIds,
    monitorAi,
    setMonitorAi,
    monitorFaces,
    setMonitorFaces,
    recordClips,
    setRecordClips,
  } = odin;
  const [open, setOpen] = useState(false),
    [chosen, setChosen] = useState<string[]>([]),
    [statuses, setStatuses] = useState<Record<string, string>>({});
  const real =
    data?.cameras.filter((c) => c.source !== "demo" && c.enabled) || [];
  useEffect(() => {
    const handle = () => {
      setChosen([...monitoringIds]);
      setOpen(true);
    };
    window.addEventListener("odin-monitor-cameras", handle);
    return () => window.removeEventListener("odin-monitor-cameras", handle);
  }, [monitoringIds]);
  const active = real.filter((c) => monitoringIds.includes(c.id));
  return (
    <>
      <div className="monitor-session-workers">
        {active.map((camera) => (
          <CameraWorker
            key={camera.id}
            camera={camera}
            onStatus={(text) =>
              setStatuses((s) =>
                s[camera.id] === text ? s : { ...s, [camera.id]: text },
              )
            }
          />
        ))}
      </div>
      {active.length > 0 && (
        <div className="monitor-session-bar">
          <span className="status-dot" />
          <button
            onClick={() => {
              setChosen([...monitoringIds]);
              setOpen(true);
            }}
          >
            <Radio size={14} />
            {active.length} cameras monitoring
            {recordClips ? " · Recording clips" : ""}
          </button>
          <button
            title="Stop all monitoring"
            onClick={() => setMonitoringIds([])}
          >
            <Square size={13} />
          </button>
        </div>
      )}
      {active.length > 0 && <aside style={{position:"fixed",bottom:80,right:16,maxWidth:360,maxHeight:260,overflowY:"auto",zIndex:50}}><WorkflowAlerts cameraIds={active.map(c => c.id)} /></aside>}
      {open && (
        <Modal
          title="Monitor multiple cameras"
          subtitle="Monitoring continues as you move between pages while this app remains open."
          wide
          onClose={() => setOpen(false)}
        >
          {real.length ? (
            <>
              <div className="session-camera-list">
                {real.map((camera) => (
                  <label key={camera.id}>
                    <input
                      type="checkbox"
                      checked={chosen.includes(camera.id)}
                      onChange={() =>
                        setChosen((s) =>
                          s.includes(camera.id)
                            ? s.filter((id) => id !== camera.id)
                            : s.length < 4
                              ? [...s, camera.id]
                              : s,
                        )
                      }
                    />
                    <CameraIcon size={18} />
                    <span>
                      <strong>{camera.name}</strong>
                      <small>
                        {monitoringIds.includes(camera.id)
                          ? statuses[camera.id] || "Connecting…"
                          : camera.location}
                      </small>
                    </span>
                    <Badge>{camera.source}</Badge>
                  </label>
                ))}
              </div>
              <p className="muted small">
                Choose up to four feeds. Use distinct stream URLs for different
                physical cameras. Device camera entries use this computer's
                webcam.
              </p>
              <div className="session-options">
                <label>
                  <input
                    type="checkbox"
                    checked={monitorFaces}
                    onChange={(e) => setMonitorFaces(e.target.checked)}
                  />
                  <ScanFace size={15} />
                  Recognize enrolled faces
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={monitorAi}
                    disabled={!(odin.aiKey || data?.capabilities.ai)}
                    onChange={(e) => setMonitorAi(e.target.checked)}
                  />
                  <Sparkles size={15} />
                  AI scene analysis (quota limited)
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={recordClips}
                    onChange={(e) => setRecordClips(e.target.checked)}
                  />
                  <Video size={15} />
                  Save 30-second webcam clips
                </label>
              </div>
              <div className="info-box">
                <Activity size={18} />
                <p>
                  Object tracking runs locally. Face matches can connect an
                  enrolled person's sightings across cameras. Unknown track IDs
                  do not establish cross-camera identity. Cloud analysis is
                  triggered by activity and subject to an hourly limit. Closing
                  the app stops capture.
                </p>
              </div>
              <div className="modal-actions">
                <Button
                  variant="danger"
                  onClick={() => {
                    setMonitoringIds([]);
                    setOpen(false);
                  }}
                >
                  Stop all
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setMonitoringIds(chosen);
                    setOpen(false);
                  }}
                >
                  Start selected cameras
                </Button>
              </div>
            </>
          ) : (
            <Empty
              icon={CameraIcon}
              title="Add a real camera first"
              text="Connect a webcam, upload a video, or enter a CORS-enabled stream URL. Demo cameras do not run monitoring actions."
            />
          )}
        </Modal>
      )}
    </>
  );
}
function CameraWorker({
  camera,
  onStatus,
}: {
  camera: Camera;
  onStatus: (text: string) => void;
}) {
  const odin = useOdin();
  const latest = useRef(odin),
    status = useRef(onStatus),
    video = useRef<HTMLVideoElement>(null);
  latest.current = odin;
  status.current = onStatus;
  const captureStarted = useRef(0), captureSession = useRef("");
  const incident = useIncidentMonitor(video, camera, odin.monitorAi, () => camera.source === "webcam" ? (Date.now() - captureStarted.current) / 1000 : video.current?.currentTime || 0, () => captureSession.current);
  useEffect(() => { if (odin.monitorAi && incident.status) status.current(incident.status); }, [incident.status, odin.monitorAi]);
  useEffect(() => {
    let alive = true,
      media: MediaStream | null = null,
      recorder: MediaRecorder | null = null,
      timer: ReturnType<typeof setTimeout>,
      segmentTimer: ReturnType<typeof setTimeout>,
      segmentBusy = false;
    const tracker = new CameraTracker(), last = new Map<string, number>(), trackUpdates = new Map<string, number>();
    const sessionId = crypto.randomUUID();
    captureSession.current = sessionId;
    let startedAt = Date.now(), previousSource = -1;
    const at = () =>
      camera.source === "webcam"
        ? (Date.now() - startedAt) / 1000
        : video.current?.currentTime || 0;
    async function emit(
      type: string,
      confidence: number,
      title: string,
      metadata: Record<string, unknown> = {},
    ) {
      const key = `${type}:${metadata.personId || metadata.trackId || ""}`;
      if (Date.now() - (last.get(key) || 0) < (metadata.trackId ? 5000 : 30000)) return;
      last.set(key, Date.now());
      const result = await latest.current.api("events", {
        cameraId: camera.id,
        type,
        confidence,
        title,
        description: `${title} in ${camera.name}.`,
        severity: type === "unknown_face" ? "warning" : "info",
        sourceTime: at(),
        sessionId,
        snapshot: captureFrame(video.current!, 480),
        ...metadata,
      });
      if (result.event?.matchedLocalRuleIds?.length) incident.trigger("Local workflow condition matched");
      await latest.current.deliver(result.executions || []);
      await latest.current.refresh();
    }
    function startSegment() {
      if (
        !alive ||
        !media ||
        segmentBusy ||
        !latest.current.recordClips ||
        camera.source !== "webcam"
      )
        return;
      segmentBusy = true;
      const segmentStarted = Date.now(),
        sourceOffset = at(),
        parts: Blob[] = [];
      const active = new MediaRecorder(media);
      recorder = active;
      active.ondataavailable = (e) => {
        if (e.data.size) parts.push(e.data);
      };
      active.onstop = async () => {
        const endedAt = Date.now(),
          mime = active.mimeType.includes("mp4") ? "video/mp4" : "video/webm";
        try {
          if (parts.length) {
            const form = new FormData();
            form.append(
              "file",
              new File(
                parts,
                `segment.${mime.includes("mp4") ? "mp4" : "webm"}`,
                { type: mime },
              ),
            );
            form.append("cameraId", camera.id);
            form.append("startedAt", String(segmentStarted));
            form.append("endedAt", String(endedAt));
            form.append("sourceOffset", String(sourceOffset));
            form.append("sessionId", sessionId);
            const r = await fetch("/api/recordings", {
              method: "POST",
              body: form,
            });
            if (!r.ok) {
              const b: any = await r.json();
              throw new Error(b.error || "Clip upload failed.");
            }
            await latest.current.refresh();
          }
        } catch (e) {
          latest.current.notify((e as Error).message, "error");
        }
        segmentBusy = false;
        if (alive && latest.current.recordClips) startSegment();
      };
      active.start(1000);
      segmentTimer = setTimeout(() => {
        if (active.state === "recording") active.stop();
      }, 30000);
    }
    async function tick() {
      if (!alive) return;
      const v = video.current;
      if (!v || v.readyState < 2 || v.paused) {
        timer = setTimeout(tick, 2000);
        return;
      }
      try {
        const currentSource = at();
        if (currentSource < previousSource) {tracker.reset(); trackUpdates.clear();}
        previousSource = currentSource;
        await serial(async () => {
          if (!alive) return;
          const detected = tracker.update(
            await detectObjects(v, latest.current.data!.settings.confidence, latest.current.data!.settings.detectionQuality),
            camera.id, Date.now(), {width: v.videoWidth, height: v.videoHeight},
          );
          incident.note(detected, v.videoWidth, v.videoHeight);
          const result = await submitTracks({detections: detected, video: v, cameraId: camera.id, sourceTime: at(), sessionId, last: trackUpdates, spatialRulesActive: latest.current.data!.workflows.some(f => f.enabled && f.nodes.some(n => n.type === "input" && (!n.cameraId || n.cameraId === camera.id)) && f.nodes.some(n => n.ruleMode === "spatial")), api: latest.current.api});
          if (result) {
            if (result.events.some(e => e.matchedLocalRuleIds?.length)) incident.trigger("Local workflow condition matched");
            await latest.current.deliver(result.executions); await latest.current.refresh();
          }
          if (
            latest.current.monitorFaces &&
            latest.current.data!.faces.length
          ) {
            const human = await faceDetector();
            const result = await human.detect(v);
            for (const f of result.face || []) {
              if (!alive) return;
              let person: any,
                score = 0.65;
              for (const p of latest.current.data!.faces) {
                const similarity = human.match.similarity(
                  f.embedding,
                  p.embedding,
                );
                if (similarity > score) {
                  person = p;
                  score = similarity;
                }
              }
              if (person)
                await emit("known_face", score, `${person.name} recognized`, {
                  personId: person.id,
                  personName: person.name,
                });
              else
                await emit(
                  "unknown_face",
                  f.faceScore,
                  "Unknown person detected",
                );
            }
          }
        });
        if (!alive) return;
        if (!latest.current.monitorAi) status.current("Monitoring · local detections active");
        if (!latest.current.recordClips && recorder?.state === "recording") {
          clearTimeout(segmentTimer);
          recorder.stop();
        }
        if (
          latest.current.recordClips &&
          camera.source === "webcam" &&
          (!recorder || recorder.state === "inactive")
        )
          startSegment();
      } catch (e) {
        if (alive) status.current((e as Error).message);
      }
      if (alive) timer = setTimeout(tick, 2000);
    }
    async function start() {
      try {
        const v = video.current!;
        if (camera.source === "webcam") {
          media = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false,
          });
          if (!alive) {
            media.getTracks().forEach((t) => t.stop());
            return;
          }
          v.srcObject = media;
        } else {
          v.src = camera.url;
          v.loop = true;
        }
        await v.play();
        startedAt = Date.now();
        captureStarted.current = startedAt;
        status.current("Loading detection models…");
        if (latest.current.recordClips) startSegment();
        void tick();
      } catch (e) {
        if (alive) status.current((e as Error).message);
      }
    }
    void start();
    return () => {
      alive = false;
      clearTimeout(timer);
      clearTimeout(segmentTimer);
      if (recorder?.state === "recording") recorder.stop();
      media?.getTracks().forEach((t) => t.stop());
      video.current?.pause();
    };
  }, [camera.id, camera.url, camera.source]);
  return (
    <video
      ref={video}
      muted
      playsInline
      crossOrigin="anonymous"
      aria-hidden="true"
    />
  );
}
