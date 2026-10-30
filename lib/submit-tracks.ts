import { captureFrame } from "./inference";
import { trackMetadata, type Detection } from "./tracking";
import type { Event, Execution } from "./types";
/** Batch one scan into one request and one workspace refresh, not one per object. */
export async function submitTracks(options: {
  detections: Detection[]; video: HTMLVideoElement; cameraId: string; sourceTime: number; sessionId?: string;
  last: Map<string, number>; api: (path: string, body: unknown) => Promise<{events: Event[]; executions: Execution[]}>;
  spatialRulesActive?: boolean;
}) {
  const {detections, video, last} = options;
  const now = Date.now();
  const selected = detections.filter(d => d.trackId && now - (last.get(d.trackId) || 0) >= (options.spatialRulesActive ? 0 : 5000)).slice(0,60);
  if (!selected.length) return null;
  const result = await options.api("events", {
    cameraId: options.cameraId, sourceTime: options.sourceTime, sessionId: options.sessionId,
    snapshot: captureFrame(video,480),
    observations: selected.map(d => {
      const metadata = trackMetadata(d,video.videoWidth,video.videoHeight);
      return {type: d.class, confidence: d.score, title: `${d.class} detected`, description: `${d.class} observed.`, severity: "info", ...metadata,
        trail: metadata.trail.filter(p => p.at > (last.get(d.trackId!) ?? -1))};
    }),
  });
  for (const d of selected) last.set(d.trackId!,now);
  for (const [id, at] of last) if (now - at > 60000) last.delete(id);
  return result;
}
