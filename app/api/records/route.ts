import { env } from "cloudflare:workers";
import {
  identity,
  jsonBody,
  save,
  fail,
  ApiError,
  readOne,
  safeEndpoint,
} from "@/lib/server";
import {
  cameraSchema,
  workflowSchema,
  integrationSchema,
  faceSchema,
  settingsSchema,
} from "@/lib/validation";
const schemas = {
  cameras: cameraSchema,
  workflows: workflowSchema,
  integrations: integrationSchema,
  faces: faceSchema,
  settings: settingsSchema,
};
export async function POST(request: Request) {
  try {
    const u = await identity();
    const { kind, data } = await jsonBody(request);
    const schema = schemas[kind as keyof typeof schemas];
    if (!schema) throw new ApiError("Unsupported record type.");
    const parsed = schema.safeParse(data);
    if (!parsed.success) throw new ApiError(parsed.error.issues[0].message);
    const value = parsed.data;
    if (kind === "cameras") {
      const c = value as any;
      if (c.source === "url") safeEndpoint(c.url);
      if (c.source === "upload" && !c.url.startsWith("/api/media/"))
        throw new ApiError("Upload a video first.");
    }
    if (
      kind === "integrations" &&
      ["mcp", "webhook", "slack", "discord"].includes((value as any).type)
    )
      safeEndpoint((value as any).endpoint);
    await save(u.userId, kind, value);
    return Response.json({ data: value });
  } catch (e) {
    return fail(e);
  }
}
export async function DELETE(request: Request) {
  try {
    const u = await identity();
    const { kind, id } = await jsonBody(request);
    if (
      ![
        "cameras",
        "workflows",
        "integrations",
        "faces",
        "reports",
        "messages",
        "events",
      ].includes(kind) ||
      typeof id !== "string"
    )
      throw new ApiError("Invalid deletion.");
    if (kind === "cameras") {
      const camera = await readOne(u.userId, kind, id);
      if (camera?.source === "upload" && env.BUCKET) {
        const key = camera.url.split("/").pop();
        await env.BUCKET.delete(`${u.userId}/${key}`);
      }
      await env
        .DB!.prepare(
          "DELETE FROM records WHERE owner=? AND kind='events' AND json_extract(data,'$.cameraId')=?",
        )
        .bind(u.userId, id)
        .run();
    }
    await env
      .DB!.prepare("DELETE FROM records WHERE owner=? AND kind=? AND id=?")
      .bind(u.userId, kind, id)
      .run();
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
