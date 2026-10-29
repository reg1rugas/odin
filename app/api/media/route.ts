import { env } from "cloudflare:workers";
import { identity, fail, ApiError } from "@/lib/server";
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      throw new ApiError("Cross-origin uploads are not allowed.", 403);
    const u = await identity();
    if (!env.BUCKET) throw new ApiError("Video storage is unavailable.", 503);
    const size = Number(request.headers.get("content-length"));
    if (size > 52_428_800)
      throw new ApiError("Maximum video size is 50 MB.", 413);
    const form = await request.formData();
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      !["video/mp4", "video/webm", "video/ogg"].includes(file.type)
    )
      throw new ApiError("Upload an MP4, WebM, or Ogg video.");
    if (file.size > 52_428_800)
      throw new ApiError("Maximum video size is 50 MB.", 413);
    const id = crypto.randomUUID();
    await env.BUCKET.put(`${u.userId}/${id}`, file.stream(), {
      httpMetadata: { contentType: file.type },
    });
    return Response.json({ url: `/api/media/${id}` });
  } catch (e) {
    return fail(e);
  }
}
