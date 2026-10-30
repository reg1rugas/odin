import type { Camera } from "./types";
import { demoCameras, demoWorkflow, seedDemoEvents } from "./demo";

export function seedWorkspace() {
  const now = Date.now();
  const cameras: Camera[] = demoCameras.map(camera => ({...camera, createdAt: now}));
  return {cameras, events: seedDemoEvents(now), workflows: cameras.map(demoWorkflow)};
}
