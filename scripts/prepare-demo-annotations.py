"""Generate recorded demo detections; not part of the application runtime.

Requires opencv-python-headless<5. Pass MobileNet-SSD deploy.prototxt and
mobilenet_iter_73000.caffemodel paths (see public/demo/CREDITS.md).
"""
import json
import sys
from pathlib import Path

import cv2

ROOT = Path(__file__).resolve().parents[1]
CLASSES = {2: "bicycle", 6: "bus", 7: "car", 12: "dog", 14: "motorcycle", 15: "person"}
CLIPS = {"cam-001": "warehouse", "cam-002": "mall", "cam-003": "park",
         "cam-004": "retail", "cam-005": "traffic", "cam-006": "factory"}


def iou(a, b):
    x, y = max(a[0], b[0]), max(a[1], b[1])
    w = max(0, min(a[0] + a[2], b[0] + b[2]) - x)
    h = max(0, min(a[1] + a[3], b[1] + b[3]) - y)
    overlap = w * h
    return overlap / max(1e-9, a[2] * a[3] + b[2] * b[3] - overlap)


net = cv2.dnn.readNetFromCaffe(sys.argv[1], sys.argv[2])
result = {"version": 2, "model": "MobileNet-SSD (VOC)", "interval": 0.2, "cameras": {}}
for camera_id, clip in CLIPS.items():
    capture = cv2.VideoCapture(str(ROOT / f"public/demo/{clip}-v2.mp4"))
    fps = capture.get(cv2.CAP_PROP_FPS)
    frames, previous, next_id = [], [], 1
    index = 0
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        index += 1
        # Every fifth frame at 24 FPS, including the first and last samples.
        if (index - 1) % 5:
            continue
        height, width = frame.shape[:2]
        windows = [(0, 0, width, height)]
        # Dense mall footage benefits from four overlapping detail passes.
        if clip == "mall":
            for x in [0, int(width * 0.35)]:
                for y in [0, int(height * 0.35)]:
                    windows.append((x, y, int(width * 0.65), int(height * 0.65)))
        detections = []
        for x, y, w, h in windows:
            crop = frame[y:y+h, x:x+w]
            net.setInput(cv2.dnn.blobFromImage(crop, 0.007843, (300, 300), 127.5))
            for raw in net.forward()[0, 0]:
                detection = raw.copy()
                detection[3] = (x + raw[3] * w) / width
                detection[4] = (y + raw[4] * h) / height
                detection[5] = (x + raw[5] * w) / width
                detection[6] = (y + raw[6] * h) / height
                detections.append(detection)
        boxes, used = [], set()
        for detection in sorted(detections, key=lambda d: -float(d[2])):
            class_id, score = int(detection[1]), float(detection[2])
            allowed = {"person"} if clip in {"warehouse", "mall", "retail", "factory"} else set(CLASSES.values())
            if class_id not in CLASSES or CLASSES[class_id] not in allowed or score < 0.5:
                continue
            x1, y1, x2, y2 = [min(1.0, max(0.0, float(v))) for v in detection[3:7]]
            bbox = [x1, y1, x2 - x1, y2 - y1]
            if bbox[2] < 0.012 or bbox[3] < 0.025:
                continue
            label = CLASSES[class_id]
            if any(b["class"] == label and iou(b["bbox"], bbox) > 0.5 for b in boxes):
                continue
            candidates = [(iou(p["bbox"], bbox), p["id"]) for p in previous
                          if p["class"] == label and p["id"] not in used]
            best = max(candidates, default=(0, ""))
            if best[0] > 0.25:
                track_id = best[1]
            else:
                track_id = f"{label}-{next_id:02d}"
                next_id += 1
            used.add(track_id)
            boxes.append({"id": track_id, "class": label, "score": round(score, 3),
                          "bbox": [round(v, 5) for v in bbox]})
            if len(boxes) == 12:
                break
        frames.append({"time": round((index - 1) / fps, 4), "boxes": boxes})
        previous = boxes
    capture.release()
    result["cameras"][camera_id] = frames
    print(clip, len(frames), "samples,", sum(len(f["boxes"]) for f in frames), "boxes", flush=True)

(ROOT / "public/demo/detections-v2.json").write_text(json.dumps(result, separators=(",", ":")) + "\n")
