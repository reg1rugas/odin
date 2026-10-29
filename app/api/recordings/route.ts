import { env } from "cloudflare:workers";
import { identity, fail, ApiError, readOne, save } from "@/lib/server";
export async function POST(request: Request) {
  try {
    const u = await identity();
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      throw new ApiError("Cross-origin uploads are not allowed.", 403);
    if (!env.BUCKET)
      throw new ApiError("Recording storage is unavailable.", 503);
    if (Number(request.headers.get("content-length")) > 52428800)
      throw new ApiError("Recording segments must be under 50 MB.", 413);
    const form = await request.formData(),
      file = form.get("file"),
      cameraId = String(form.get("cameraId") || "");
    const camera = await readOne(u.userId, "cameras", cameraId);
    if (!camera || camera.source === "demo")
      throw new ApiError("Choose a connected camera.");
    if (
      !(file instanceof File) ||
      !["video/webm", "video/mp4", "video/ogg"].includes(file.type) ||
      file.size > 52428800
    )
      throw new ApiError("Upload a video segment under 50 MB.");
    const startedAt = Number(form.get("startedAt")),
      endedAt = Number(form.get("endedAt")),
      sourceOffset = Number(form.get("sourceOffset")),
      sessionId = String(form.get("sessionId") || "");
    if (
      ![startedAt, endedAt, sourceOffset].every(Number.isFinite) ||
      endedAt <= startedAt ||
      sourceOffset < 0 ||
      !sessionId ||
      sessionId.length > 120
    )
      throw new ApiError("Invalid recording timestamps.");
    const id = crypto.randomUUID();
    const url = `/api/media/${id}`;
    await env.BUCKET.put(`${u.userId}/${id}`, file.stream(), {
      httpMetadata: { contentType: file.type },
    });
    const recording = {
      id,
      cameraId,
      name: camera.name,
      url,
      startedAt,
      endedAt,
      sourceOffset,
      duration: (endedAt - startedAt) / 1000,
      sessionId,
    };
    try {
      await save(u.userId, "recordings", recording);
    } catch (error) {
      await env.BUCKET.delete(`${u.userId}/${id}`);
      throw error;
    }
    return Response.json({ recording });
  } catch (e) {
    return fail(e);
  }
}
