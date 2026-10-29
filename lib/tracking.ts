export type Detection = {
  bbox: number[];
  class: string;
  score: number;
  trackId?: string;
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
  private tracks: { id: string; box: number[]; class: string; seen: number }[] =
    [];
  private counter = 0;
  private session = crypto.randomUUID().slice(0, 8);
  private camera = "";
  update(
    detections: Detection[],
    cameraId: string,
    now = Date.now(),
  ): Detection[] {
    if (this.camera !== cameraId) {
      this.tracks = [];
      this.camera = cameraId;
    }
    this.tracks = this.tracks.filter((t) => now - t.seen < 8000);
    const used = new Set<string>();
    return detections.map((d) => {
      let candidate: (typeof this.tracks)[number] | undefined;
      let best = 0.2;
      for (const t of this.tracks) {
        if (t.class !== d.class || used.has(t.id)) continue;
        const score = overlap(t.box, d.bbox);
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
        };
        this.tracks.push(candidate);
      } else {
        candidate.box = d.bbox;
        candidate.seen = now;
      }
      used.add(candidate.id);
      return { ...d, trackId: candidate.id };
    });
  }
}
