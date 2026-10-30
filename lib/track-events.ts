import type { Event } from "./types";

/** Deterministic IDs consolidate heartbeats without joining different tracks. */
export async function trackEventId(cameraId: string, type: string, trackId: string) {
  const bytes = new TextEncoder().encode(JSON.stringify([cameraId, type, trackId]));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return "track-" + Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function mergeTrackEvent(previous: Event | null, incoming: Event): Event {
  if (!previous) return {
    ...incoming,
    firstSeen: Math.min(incoming.firstSeen ?? incoming.timestamp, incoming.timestamp),
    lastSeen: incoming.timestamp,
  };
  const points = new Map<string, NonNullable<Event["trail"]>[number]>();
  for (const p of [...(previous.trail || []), ...(incoming.trail || [])])
    points.set(`${p.at}:${p.x}:${p.y}`, p);
  return {
    ...previous,
    ...incoming,
    firstSeen: previous.firstSeen ?? previous.timestamp,
    lastSeen: incoming.timestamp,
    acknowledged: previous.acknowledged,
    confidence: Math.max(previous.confidence, incoming.confidence),
    observationCount: Math.max(previous.observationCount || 1, incoming.observationCount || 1),
    trail: [...points.values()].sort((a, b) => a.at - b.at).slice(-120),
  };
}
