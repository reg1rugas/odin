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
import { objectDetector, faceDetector, captureFrame } from "@/lib/inference";
import { CameraTracker } from "@/lib/tracking";
import { queuedAnalysis } from "@/lib/analysis-queue";
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
        {active.map((camera, index) => (
          <CameraWorker
            key={camera.id}
            camera={camera}
            index={index}
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
                  spaced and may skip cycles when your provider is busy. Closing
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
  index,
  onStatus,
}: {
  camera: Camera;
  index: number;
  onStatus: (text: string) => void;
}) {
  const odin = useOdin();
  const latest = useRef(odin),
    status = useRef(onStatus),
    video = useRef<HTMLVideoElement>(null);
  latest.current = odin;
  status.current = onStatus;
  useEffect(() => {
    let alive = true,
      media: MediaStream | null = null,
      recorder: MediaRecorder | null = null,
      timer: ReturnType<typeof setTimeout>,
      segmentTimer: ReturnType<typeof setTimeout>,
      segmentBusy = false;
    const tracker = new CameraTracker(),
      last = new Map<string, number>(),
      samples: { image: string; at: number }[] = [];
    const sessionId = crypto.randomUUID();
    let startedAt = Date.now(),
      nextAnalysis = Date.now() + 20000 + index * 20000;
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
      if (Date.now() - (last.get(key) || 0) < 30000) return;
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
        const image = captureFrame(v, 480);
        if (samples.length && at() < samples.at(-1)!.at) samples.length = 0;
        samples.push({ image, at: at() });
        if (samples.length > 6) samples.shift();
        await serial(async () => {
          if (!alive) return;
          const detector = await objectDetector();
          const detected = tracker.update(
            await detector.detect(
              v,
              12,
              latest.current.data!.settings.confidence,
            ),
            camera.id,
          );
          for (const p of detected) {
            if (!alive) return;
            await emit(p.class, p.score, `${p.class} detected`, {
              trackId: p.trackId,
            });
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
        status.current("Monitoring · local detections active");
        if (latest.current.monitorAi && Date.now() >= nextAnalysis) {
          nextAnalysis = Date.now() + 60000;
          try {
            const result = await queuedAnalysis(() =>
              latest.current.api("analyze", {
                cameraId: camera.id,
                frames: [...samples],
                sourceTime: at(),
                sessionId,
              }),
            );
            await latest.current.deliver(result.executions || []);
            await latest.current.refresh();
          } catch (e) {
            status.current((e as Error).message);
          }
        }
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
