import type { BoxDetection } from "./detection-options";
export type IncidentSegment = { blob: Blob; at: number; startedAt: number; duration: number };
export type IncidentObservation = { type: string; trackId?: string; x?: number; y?: number; at?: number };
export type IncidentEvidence = { id: string; reason: string; segments: IncidentSegment[]; observations: IncidentObservation[] };
/** One capture per camera: independent playable segments, bounded memory, no microphone. */
export class IncidentBuffer {
  private canvas = document.createElement("canvas");
  private stream?: MediaStream;
  private recorder?: MediaRecorder;
  private drawTimer?: ReturnType<typeof setInterval>;
  private stopTimer?: ReturnType<typeof setTimeout>;
  private ring: IncidentSegment[] = [];
  private pending?: { id: string; reason: string; started: number; until: number; segments: IncidentSegment[]; observations: IncidentObservation[] };
  private observed = new Map<string, { x: number; y: number; seen: number; type: string }>();
  private observations: IncidentObservation[] = [];
  private nextAllowed = 0;
  private nextQuiet = Date.now() + 600000;
  private busy = false;
  private alive = false;
  private lastPixels?: Uint8ClampedArray;
  private motionStreak = 0;
  private frames = 0;
  private video: HTMLVideoElement;
  private sourceTime: () => number;
  private onIncident: (evidence: IncidentEvidence) => Promise<void>;
  private onStatus: (text: string) => void;
  constructor(video: HTMLVideoElement, sourceTime: () => number, onIncident: (evidence: IncidentEvidence) => Promise<void>, onStatus: (text: string) => void) {
    this.video = video; this.sourceTime = sourceTime; this.onIncident = onIncident; this.onStatus = onStatus;
  }
  start() {
    if (typeof MediaRecorder === "undefined" || !this.canvas.captureStream) throw new Error("This browser cannot buffer incident video. Manual frame analysis remains available.");
    this.alive = true;
    this.drawTimer = setInterval(() => {
      try {
        if (!this.alive || this.video.paused || this.video.readyState < 2) return;
        if (!this.stream) {
          this.canvas.width = Math.min(640, this.video.videoWidth);
          this.canvas.height = Math.max(1, Math.round(this.video.videoHeight * this.canvas.width / this.video.videoWidth));
          this.stream = this.canvas.captureStream(5);
          this.record();
          this.onStatus("Incident buffer active · local detection first");
        }
        const ctx = this.canvas.getContext("2d")!;
        ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        if (++this.frames % 5 === 0) {
          const small = document.createElement("canvas"); small.width = 64; small.height = 36;
          small.getContext("2d")!.drawImage(this.canvas, 0, 0, 64, 36);
          const pixels = small.getContext("2d")!.getImageData(0, 0, 64, 36).data;
          if (this.lastPixels) {
            let changed = 0;
            for (let i = 0; i < pixels.length; i += 4) if (Math.abs(pixels[i] - this.lastPixels[i]) + Math.abs(pixels[i+1] - this.lastPixels[i+1]) + Math.abs(pixels[i+2] - this.lastPixels[i+2]) > 100) changed++;
            this.motionStreak = changed / (64 * 36) > 0.2 ? this.motionStreak + 1 : 0;
            if (this.motionStreak >= 2) this.trigger("Sustained scene motion");
          }
          this.lastPixels = pixels;
        }
        if (Date.now() >= this.nextQuiet) { this.nextQuiet = Date.now() + 600000; this.trigger("Periodic context check"); }
      } catch (error) { this.onStatus((error as Error).message); this.stop(); }
    }, 200);
  }
  note(detections: (BoxDetection & {trackId?: string})[], width: number, height: number) {
    const now = Date.now();
    this.observations = detections.slice(0,60).map(d => ({type: d.class, trackId: d.trackId, at: this.sourceTime(), x: Math.max(0, Math.min(1,(d.bbox[0]+d.bbox[2]/2)/width)), y: Math.max(0,Math.min(1,(d.bbox[1]+d.bbox[3]/2)/height))}));
    for (const d of this.observations) {
      if (!d.trackId) continue;
      const previous = this.observed.get(d.trackId);
      if (!previous) this.trigger(`New ${d.type} track`);
      else if (Math.hypot(d.x! - previous.x, d.y! - previous.y) > 0.08) this.trigger(`${d.type} moved across the frame`);
      const moved = !previous || Math.hypot(d.x! - previous.x, d.y! - previous.y) > 0.08;
      this.observed.set(d.trackId, {x: moved ? d.x! : previous.x, y: moved ? d.y! : previous.y, seen: now, type: d.type});
    }
    if (this.pending) {
      const observations = new Map(this.pending.observations.map(o => [o.trackId || o.type, o]));
      for (const o of this.observations) observations.set(o.trackId || o.type, o);
      this.pending.observations = [...observations.values()].slice(-60);
    }
    for (const [id, value] of this.observed) if (now - value.seen > 10000) { this.trigger(`${value.type} track no longer visible`); this.observed.delete(id); }
  }
  deferUntil(at: number) { this.nextAllowed = Math.max(this.nextAllowed, at); }
  trigger(reason: string) {
    if (!this.alive || this.busy) return;
    const now = Date.now();
    if (this.pending) {
      this.pending.until = Math.min(this.pending.started + 30000, now + 10000);
      return;
    }
    if (now < this.nextAllowed) return;
    this.pending = {id: crypto.randomUUID(), reason, started: now, until: now + 10000, segments: [...this.ring], observations: [...this.observations]};
    this.onStatus(`Collecting incident evidence · ${reason}`);
  }
  private record() {
    if (!this.alive || !this.stream) return;
    const mime = ["video/webm;codecs=vp8", "video/webm", "video/mp4"].find(m => MediaRecorder.isTypeSupported(m));
    if (!mime) { this.onStatus("No supported incident video encoder. Use manual frame analysis."); this.stop(); return; }
    const recorder = new MediaRecorder(this.stream, {mimeType: mime, videoBitsPerSecond: 300000});
    this.recorder = recorder;
    const chunks: Blob[] = [], startedAt = Date.now(), at = this.sourceTime();
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.onerror = () => { this.onStatus("Incident video encoding failed."); this.stop(); };
    recorder.onstop = () => {
      if (!this.alive) return;
      const duration = (Date.now() - startedAt) / 1000;
      const blob = new Blob(chunks, {type: mime.split(";")[0]});
      // Never combine evidence across seeks, loops, pauses, or long background throttling.
      if (this.video.paused || duration > 10 || Math.abs(this.sourceTime() - at - duration) > 3 || blob.size > 3_000_000) {
        this.ring = []; this.pending = undefined; this.observed.clear(); this.lastPixels = undefined;
        this.onStatus("Incident buffer reset after pause, seek, or capture interruption.");
      } else if (blob.size) {
        const segment = {blob, at, startedAt, duration};
        this.ring = [...this.ring, segment].slice(-2);
        if (this.pending) {
          this.pending.segments.push(segment);
          if (Date.now() >= this.pending.until || this.pending.segments.length >= 8) {
            const ready = this.pending; this.pending = undefined; this.busy = true; this.nextAllowed = Date.now() + 60000;
            if (ready.segments.reduce((n,s) => n+s.blob.size,0) <= 10_000_000)
              void this.onIncident({...ready, observations: ready.observations}).catch(e => this.onStatus((e as Error).message)).finally(() => { this.busy = false; });
            else { this.busy = false; this.onStatus("Incident exceeds upload size limit; evidence skipped."); }
          }
        }
      }
      try { this.record(); } catch (error) { this.onStatus((error as Error).message); this.stop(); }
    };
    recorder.start();
    this.stopTimer = setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 5000);
  }
  stop() {
    this.alive = false; clearInterval(this.drawTimer); clearTimeout(this.stopTimer);
    if (this.recorder?.state === "recording") this.recorder.stop();
    this.stream?.getTracks().forEach(t => t.stop()); this.stream = undefined;
    this.ring = []; this.pending = undefined; this.observed.clear();
  }
}
