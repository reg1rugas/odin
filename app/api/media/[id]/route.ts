import { env } from "cloudflare:workers";
import { identity, fail, ApiError } from "@/lib/server";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const u = await identity();
    const { id } = await params;
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new ApiError("Invalid media ID.");
    if (!env.BUCKET) throw new ApiError("Media storage is unavailable.", 503);
    const key = `${u.userId}/${id}`;
    const meta = await env.BUCKET.head(key);
    if (!meta) throw new ApiError("Video not found.", 404);
    const range = request.headers.get("range");
    const headers = new Headers({
      "Content-Type": meta.httpMetadata?.contentType || "video/mp4",
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    });
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match)
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${meta.size}` },
        });
      const start = Number(match[1]),
        end = Math.min(
          match[2] ? Number(match[2]) : meta.size - 1,
          meta.size - 1,
        );
      if (start > end || start >= meta.size)
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${meta.size}` },
        });
      const obj = await env.BUCKET.get(key, {
        range: { offset: start, length: end - start + 1 },
      });
      headers.set("Content-Range", `bytes ${start}-${end}/${meta.size}`);
      headers.set("Content-Length", String(end - start + 1));
      return new Response(obj!.body, { status: 206, headers });
    }
    const obj = await env.BUCKET.get(key);
    headers.set("Content-Length", String(meta.size));
    return new Response(obj!.body, { headers });
  } catch (e) {
    return fail(e);
  }
}
