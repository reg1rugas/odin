import { summarizeMovement } from "./movement.ts";
export type Detection = {
  bbox: number[];
  class: string;
  score: number;
  trackId?: string;
  firstSeen?: number;
  observationCount?: number;
  trail?: { x: number; y: number; at: number }[];
};
export function overlap(a: number[], b: number[]) {
  const width = Math.max(
    0,
    Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]),
  );
  const height = Math.max(
    0,
    Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]),
  );
  const area = width * height;
  return area / Math.max(1, a[2] * a[3] + b[2] * b[3] - area);
}
/** Geometric association within one camera; this does not assert cross-camera identity. */
export class CameraTracker {
  private tracks: { id: string; box: number[]; class: string; seen: number; firstSeen: number; count: number; trail: { x: number; y: number; at: number }[] }[] =
    [];
  private counter = 0;
  private session = crypto.randomUUID().slice(0, 8);
  private camera = "";
  reset() { this.tracks = []; this.counter = 0; this.session = crypto.randomUUID().slice(0,8); this.camera = ""; }
  update(
    detections: Detection[],
    cameraId: string,
    now = Date.now(),
    frame?: { width: number; height: number },
  ): Detection[] {
    if (this.camera !== cameraId) {
      this.tracks = [];
      this.camera = cameraId;
    }
    this.tracks = this.tracks.filter((t) => now - t.seen < 8000);
    const used = new Set<string>();
    return detections.map((d) => {
      let candidate: (typeof this.tracks)[number] | undefined;
      let best = 0;
      for (const t of this.tracks) {
        if (t.class !== d.class || used.has(t.id)) continue;
        const iou = overlap(t.box, d.bbox);
        let score = iou > 0.2 ? 1 + iou : 0;
        // A small/fast object can cross a boundary between scans without overlapping
        // its previous box. Use short-term motion and size gates as a fallback.
        if (!score && now - t.seen <= 4000) {
          const point = t.trail.at(-1)!;
          const before = t.trail.at(-2);
          const dt = before ? Math.max(1, point.at - before.at) : 1;
          const ahead = Math.min(2000, Math.max(0, now - t.seen));
          const x = point.x + (before ? (point.x - before.x) * ahead / dt : 0);
          const y = point.y + (before ? (point.y - before.y) * ahead / dt : 0);
          const cx = d.bbox[0] + d.bbox[2] / 2, cy = d.bbox[1] + d.bbox[3] / 2;
          const distance = Math.min(Math.hypot(cx - x, cy - y), Math.hypot(cx - point.x, cy - point.y) * 1.15);
          const diagonal = frame ? Math.hypot(frame.width, frame.height) : 0;
          const gate = Math.min(diagonal ? diagonal * 0.2 : Infinity, Math.max(Math.hypot(t.box[2], t.box[3]) * 1.5, diagonal * 0.08));
          const ratio = d.bbox[2] * d.bbox[3] / Math.max(1, t.box[2] * t.box[3]);
          if (distance < gate && ratio >= 0.25 && ratio <= 4) score = 0.2 + 0.6 * (1 - distance / gate);
        }
        if (score > best) {
          best = score;
          candidate = t;
        }
      }
      if (!candidate) {
        candidate = {
          id: `${cameraId.slice(0, 80)}:${this.session}:track-${++this.counter}`,
          box: d.bbox,
          class: d.class,
          seen: now,
          firstSeen: now,
          count: 0,
          trail: [],
        };
        this.tracks.push(candidate);
      } else {
        candidate.box = d.bbox;
        candidate.seen = now;
      }
      used.add(candidate.id);
      candidate.count++;
      candidate.trail.push({ x: d.bbox[0] + d.bbox[2] / 2, y: d.bbox[1] + d.bbox[3] / 2, at: now });
      candidate.trail = candidate.trail.slice(-120);
      return { ...d, trackId: candidate.id, firstSeen: candidate.firstSeen, observationCount: candidate.count, trail: [...candidate.trail] };
    });
  }
}

/** Positions are fractions of the frame so records work at any display size. */
export function trackMetadata(detection: Detection, width: number, height: number) {
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const trail = (detection.trail || []).map((p) => ({
    x: clamp(p.x / Math.max(1, width)), y: clamp(p.y / Math.max(1, height)), at: p.at,
  }));
  return {
    trackId: detection.trackId,
    firstSeen: detection.firstSeen,
    observationCount: detection.observationCount,
    position: trail.at(-1),
    movement: summarizeMovement(trail),
    trail,
  };
}
