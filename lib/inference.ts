// Models load on demand; no camera frames leave the browser for object/face detection.
declare global {
  interface Window {
    cocoSsd: any;
    Human: any;
    tf: any;
  }
}
const scripts = new Map<string, Promise<void>>();
function loadScript(src: string) {
  if (scripts.has(src)) return scripts.get(src)!;
  const promise = new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.crossOrigin = "anonymous";
    el.onload = () => resolve();
    el.onerror = () => {
      el.remove();
      scripts.delete(src);
      reject(
        new Error(
          "Model library could not load. Check your internet connection.",
        ),
      );
    };
    document.head.appendChild(el);
  });
  scripts.set(src, promise);
  return promise;
}
let detector: any;
let loading: Promise<any> | undefined;
export async function objectDetector() {
  if (detector) return detector;
  if (!loading)
    loading = (async () => {
      await loadScript(
        "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js",
      );
      await loadScript(
        "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js",
      );
      return (detector = await window.cocoSsd.load({
        base: "lite_mobilenet_v2",
      }));
    })().catch((e) => {
      loading = undefined;
      throw e;
    });
  return loading;
}
let human: any;
let humanLoading: Promise<any> | undefined;
export async function faceDetector() {
  if (human) return human;
  if (!humanLoading)
    humanLoading = (async () => {
      await loadScript(
        "https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/dist/human.js",
      );
      const Constructor = window.Human.Human || window.Human;
      human = new Constructor({
        backend: "webgl",
        modelBasePath:
          "https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/models/",
        filter: { enabled: false },
        face: {
          enabled: true,
          detector: { rotation: true, maxDetected: 10 },
          mesh: { enabled: true },
          description: { enabled: true },
          iris: { enabled: false },
          emotion: { enabled: false },
          antispoof: { enabled: false },
          liveness: { enabled: false },
        },
        body: { enabled: false },
        hand: { enabled: false },
        object: { enabled: false },
        gesture: { enabled: false },
      });
      await human.load();
      await human.warmup();
      return human;
    })().catch((e) => {
      human = undefined;
      humanLoading = undefined;
      throw e;
    });
  return humanLoading;
}
export function captureFrame(video: HTMLVideoElement, maxWidth = 960) {
  if (!video.videoWidth || video.readyState < 2)
    throw new Error("Wait for the camera frame to load.");
  const canvas = document.createElement("canvas");
  const ratio = Math.min(1, maxWidth / video.videoWidth);
  canvas.width = video.videoWidth * ratio;
  canvas.height = video.videoHeight * ratio;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  try {
    return canvas.toDataURL("image/jpeg", 0.75);
  } catch {
    throw new Error(
      "This source blocks frame access. Enable CORS on the video server, or upload a video.",
    );
  }
}
export async function fileImage(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 640 / bitmap.width);
  canvas.width = bitmap.width * scale;
  canvas.height = bitmap.height * scale;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}
