"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { sampleDemoBoxes, type DemoBox, type DemoFrame } from "@/lib/demo-playback";
import type { Camera } from "@/lib/types";

type Annotations = { cameras: Record<string, DemoFrame[]> };
let annotations: Promise<Annotations> | undefined;
function loadAnnotations() {
  return annotations ??= fetch("/demo/detections-v2.json")
    .then(response => {
      if (!response.ok) throw new Error("Recorded detections could not load");
      return response.json() as Promise<Annotations>;
    }).catch(error => { annotations = undefined; throw error; });
}

export function DemoOverlay({cameraId, videoRef}: {
  cameraId: string;
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  const [boxes, setBoxes] = useState<DemoBox[]>([]);
  const [rect, setRect] = useState({left: 0, top: 0, width: 100, height: 100});
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const video = videoRef.current, stage = video?.parentElement;
    if (!video || !stage) return;
    let disposed = false, request = 0, last = -1;
    let frames: DemoFrame[] = [];
    setBoxes([]);
    setFailed(false);
    void loadAnnotations().then(data => {
      if (!disposed) frames = data.cameras[cameraId] || [];
    }).catch(() => { if (!disposed) setFailed(true); });
    const resize = () => {
      if (!video.videoWidth || !stage.clientWidth || !stage.clientHeight) return;
      const scale = Math.min(stage.clientWidth / video.videoWidth, stage.clientHeight / video.videoHeight);
      const width = video.videoWidth * scale, height = video.videoHeight * scale;
      setRect({left: (stage.clientWidth - width) / 2 / stage.clientWidth * 100,
        top: (stage.clientHeight - height) / 2 / stage.clientHeight * 100,
        width: width / stage.clientWidth * 100, height: height / stage.clientHeight * 100});
    };
    const tick = (now: number) => {
      if (now - last >= 80) {
        setBoxes(sampleDemoBoxes(frames, video.currentTime));
        last = now;
      }
      request = requestAnimationFrame(tick);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    video.addEventListener("loadedmetadata", resize);
    resize();
    request = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      cancelAnimationFrame(request);
      observer.disconnect();
      video.removeEventListener("loadedmetadata", resize);
    };
  }, [cameraId, videoRef]);
  return <div className="detection-layer demo-detection-layer" aria-label="Recorded object detections"
    style={{inset: "auto", left: `${rect.left}%`, top: `${rect.top}%`, width: `${rect.width}%`, height: `${rect.height}%`}}>
    {boxes.map(box => <div key={box.id} className="live-box" style={{left: `${box.bbox[0]*100}%`, top: `${box.bbox[1]*100}%`, width: `${box.bbox[2]*100}%`, height: `${box.bbox[3]*100}%`}}>
      <span style={box.bbox[0] > 0.65 ? {left: "auto", right: 0} : undefined}>{box.class} · {box.id.split("-").at(-1)} · {Math.round(box.score*100)}%</span>
    </div>)}
    {failed && <small className="demo-overlay-error">Recorded boxes unavailable</small>}
  </div>;
}

export function DemoVideo({camera, controls = false}: {camera: Camera; controls?: boolean}) {
  const video = useRef<HTMLVideoElement>(null);
  return <div className="demo-video">
    <video ref={video} src={camera.url} poster={camera.thumbnail} autoPlay muted loop playsInline controls={controls} preload="metadata" aria-label={`${camera.name} recorded sample`} />
    <DemoOverlay cameraId={camera.id} videoRef={video} />
  </div>;
}
