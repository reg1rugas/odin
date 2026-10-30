export type DemoBox = {
  id: string;
  class: string;
  score: number;
  bbox: number[];
};
export type DemoFrame = { time: number; boxes: DemoBox[] };

/** Sample by media time, so seeking, pausing, and looping cannot drift. */
export function sampleDemoBoxes(frames: DemoFrame[], time: number): DemoBox[] {
  if (!frames.length || !Number.isFinite(time) || time < frames[0].time)
    return [];
  let low = 0, high = frames.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (frames[mid].time <= time) low = mid + 1;
    else high = mid;
  }
  const before = frames[low - 1], after = frames[low];
  if (time - before.time > 0.3) return [];
  if (!after || after.time - before.time > 0.3) return before.boxes;
  const progress = (time - before.time) / (after.time - before.time);
  return before.boxes.map(box => {
    const next = after.boxes.find(candidate => candidate.id === box.id);
    return next ? {...box, bbox: box.bbox.map((value, i) => value + (next.bbox[i] - value) * progress)} : box;
  });
}
