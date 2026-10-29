import {
  identity,
  jsonBody,
  fail,
  ApiError,
  gemini,
  readOne,
  save,
  runWorkflows,
} from "@/lib/server";
import { eventInput } from "@/lib/validation";
export async function POST(request: Request) {
  try {
    const u = await identity();
    const { image, cameraId, prompt } = await jsonBody(request);
    const camera = await readOne(u.userId, "cameras", cameraId);
    if (!camera || camera.source === "demo")
      throw new ApiError("Choose a connected camera.");
    const result = await gemini(
      u.userId,
      `Analyze this camera frame. Describe only visible observations. Never identify a person, infer intent or claim a medical diagnosis. Return JSON {summary:string,events:[{title:string,description:string,severity:'info'|'warning'|'critical',type:string,confidence:number}]}. Return at most 3 events. Use COCO object class names when possible. Operator focus: ${typeof prompt === "string" ? prompt.slice(0, 1000) : "Describe significant activity."}`,
      request,
      image,
      true,
    );
    if (!Array.isArray(result.events))
      throw new ApiError("Analysis returned an invalid event list.", 502);
    const events = [];
    const executions = [];
    for (const item of result.events.slice(0, 3)) {
      const parsed = eventInput.safeParse({ ...item, cameraId });
      if (!parsed.success) continue;
      const event = {
        ...parsed.data,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        acknowledged: false,
      };
      await save(u.userId, "events", event);
      events.push(event);
      executions.push(...(await runWorkflows(u.userId, event)));
    }
    return Response.json({
      summary: String(result.summary || "Frame analyzed."),
      events,
      executions,
    });
  } catch (e) {
    return fail(e);
  }
}
