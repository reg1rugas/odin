import {
  identity,
  jsonBody,
  save,
  fail,
  ApiError,
  readOne,
  runWorkflows,
} from "@/lib/server";
import { eventInput } from "@/lib/validation";
import type { Event } from "@/lib/types";
export async function POST(request: Request) {
  try {
    const u = await identity();
    const parsed = eventInput.safeParse(await jsonBody(request));
    if (!parsed.success) throw new ApiError(parsed.error.issues[0].message);
    const camera = await readOne(u.userId, "cameras", parsed.data.cameraId);
    if (!camera || camera.source === "demo")
      throw new ApiError("Use a connected camera to record detections.");
    const event: Event = {
      ...parsed.data,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      acknowledged: false,
    };
    await save(u.userId, "events", event);
    const executions = await runWorkflows(u.userId, event);
    return Response.json({ event, executions });
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
