"use client";
import { useEffect, useRef, useState } from "react";
import { IncidentBuffer, type IncidentEvidence } from "@/lib/incident-buffer";
import { useOdin } from "./odin-context";
import type { Camera, Incident, Execution } from "@/lib/types";
import type { BoxDetection } from "@/lib/detection-options";
// Shared across viewers so uploads/model requests do not stampede the backend.
let cloudWork: Promise<unknown> = Promise.resolve();
export function useIncidentMonitor(video: React.RefObject<HTMLVideoElement | null>, camera: Camera, enabled: boolean, sourceTime: () => number, getSessionId?: () => string) {
  const odin = useOdin();
  const latest = useRef({odin, camera, sourceTime, getSessionId});
  useEffect(() => { latest.current = {odin, camera, sourceTime, getSessionId}; }, [odin, camera, sourceTime, getSessionId]);
  const buffer = useRef<IncidentBuffer | null>(null);
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (!enabled || camera.source === "demo" || !video.current) return;
    let alive = true;
    const sessionId = crypto.randomUUID();
    const update = (text: string) => { if (alive) setStatus(text); };
    const send = async (evidence: IncidentEvidence) => {
      update("Incident ready · awaiting analysis slot");
      const task = cloudWork.then(async () => {
        if (!alive) return;
        const {odin, camera} = latest.current;
        update("Analyzing incident clip with Gemini…");
        const form = new FormData();
        form.set("metadata", JSON.stringify({id: evidence.id, cameraId: camera.id, sessionId: latest.current.getSessionId?.() || sessionId, reason: evidence.reason, segments: evidence.segments.map(s => ({at: s.at, startedAt: s.startedAt, duration: s.duration})), observations: evidence.observations}));
        evidence.segments.forEach((s,i) => form.append("clips", s.blob, `segment-${i}.webm`));
        const response = await fetch("/api/incidents", {method: "POST", headers: odin.aiKey ? {"x-odin-ai-key": odin.aiKey} : {}, body: form});
        const result = await response.json() as {error?: string; incident: Incident; executions?: Execution[]};
        if (!response.ok) { await odin.refresh(); throw new Error(result.error || "Incident analysis failed."); }
        await odin.deliver(result.executions || []); await odin.refresh();
        buffer.current?.deferUntil(result.incident.status === "skipped" ? (Math.floor(Date.now() / 3600000) + 1) * 3600000 : Date.now() + 3600000 / (odin.data?.settings.aiChecksPerHour ?? 12));
        update(`${result.incident.status}: ${result.incident.summary}`);
      });
      cloudWork = task.catch(() => {}); await task;
    };
    const capture = new IncidentBuffer(video.current, () => latest.current.sourceTime(), send, update);
    buffer.current = capture;
    try { capture.start(); } catch (error) { update((error as Error).message); }
    return () => { alive = false; capture.stop(); buffer.current = null; };
  }, [enabled, camera.id, camera.source, camera.url, video]);
  return {status, trigger: (reason: string) => buffer.current?.trigger(reason), note: (detections: (BoxDetection & {trackId?: string})[], width: number, height: number) => buffer.current?.note(detections, width, height)};
}
