import {
  identity,
  jsonBody,
  save,
  fail,
  ApiError,
  readOne,
  readAll,
  runWorkflows,
} from "@/lib/server";
import { eventInput } from "@/lib/validation";
import { evaluateSpatialRules } from "@/lib/spatial-rules";
import type { Workflow, Event } from "@/lib/types";
import { trackEventId, mergeTrackEvent } from "@/lib/track-events";
export async function POST(request: Request) {
  try {
    const u = await identity();
    const body = await jsonBody(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError("Send a detection observation.");
    if (body.observations && (!Array.isArray(body.observations) || body.observations.length > 60 || !body.observations.length))
      throw new ApiError("Send between one and 60 observations.");
    const observations = body.observations ? body.observations.map((item: Record<string, unknown>) => ({...item, cameraId: body.cameraId, snapshot: body.snapshot, sourceTime: body.sourceTime, sessionId: body.sessionId})) : [body];
    const parsed = observations.map((item: unknown) => eventInput.safeParse(item));
    for (const item of parsed) if (!item.success) throw new ApiError(item.error.issues[0].message);
    const camera = await readOne(u.userId, "cameras", body.cameraId);
    if (!camera || camera.source === "demo") throw new ApiError("Use a connected camera to record detections.");
    const workflows = await readAll<Workflow>(u.userId, "workflows");
    const events: Event[] = [], executions = [];
    for (const item of parsed) {
      if (!item.success) continue;
      let event: Event = {...item.data, id: crypto.randomUUID(), timestamp: Date.now(), acknowledged: false, origin: "local"};
      if (event.personId) {
        const person = await readOne(u.userId, "faces", event.personId);
        if (!person) throw new ApiError("Enrolled person not found.");
        event.personName = person.name;
      }
      if (event.trackId) {
        const trackId = event.trackId;
        event.id = await trackEventId(event.cameraId, event.type, trackId);
        const previous = await readOne<Event>(u.userId, "events", event.id);
        const local = evaluateSpatialRules(workflows, event, previous);
        event.matchedLocalRuleIds = local.matches; event.spatialState = local.states;
        event = mergeTrackEvent(previous, event);
        const label = event.type === "person" ? "Person" : event.type;
        event.title = `${label} · track ${trackId.split("-").at(-1)}`;
        event.description = `${label} tracked in ${camera.name}. ${event.observationCount || 1} observations; first seen ${new Date(event.firstSeen!).toISOString()}.`;
      }
      await save(u.userId, "events", event);
      events.push(event);
      executions.push(...await runWorkflows(u.userId, event, workflows));
    }
    return Response.json({event: events[0], events, executions});
  } catch (e) {
    return fail(e);
  }
}
export async function PATCH(request: Request) {
  try {
    const u = await identity();
    const { id } = await jsonBody(request);
    const e = await readOne<Event>(u.userId, "events", id);
    if (!e) throw new ApiError("Event not found.", 404);
    await save(u.userId, "events", { ...e, acknowledged: true });
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
