export const OBJECT_CLASSES = [
  "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat", "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket", "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch", "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse", "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink", "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush",
] as const;
export type BoxDetection = { class: string; score: number; bbox: number[] };
export function suppressDuplicates(boxes: BoxDetection[], limit = 60): BoxDetection[] {
  const kept: BoxDetection[] = [];
  for (const box of [...boxes].sort((a, b) => b.score - a.score)) {
    if (box.bbox.some(n => !Number.isFinite(n)) || box.bbox[2] <= 0 || box.bbox[3] <= 0) continue;
    const duplicate = kept.some(other => {
      if (other.class !== box.class) return false;
      const [x, y, w, h] = box.bbox, [ox, oy, ow, oh] = other.bbox;
      const intersection = Math.max(0, Math.min(x + w, ox + ow) - Math.max(x, ox)) * Math.max(0, Math.min(y + h, oy + oh) - Math.max(y, oy));
      return intersection / Math.max(1, w * h + ow * oh - intersection) > 0.45;
    });
    if (!duplicate) kept.push(box);
    if (kept.length >= limit) break;
  }
  return kept;
}
