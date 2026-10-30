import { env } from "cloudflare:workers";
import { z } from "zod";
import { identity, ApiError, fail, readOne, save, secret } from "@/lib/server";
import { analyzeScene } from "@/lib/scene-analysis";
import type { Incident } from "@/lib/types";
const metadata = z.object({
  id: z.string().uuid(), cameraId: z.string().min(1).max(120), sessionId: z.string().min(1).max(120),
  reason: z.string().min(1).max(500),
  segments: z.array(z.object({at: z.number().finite().min(0), startedAt: z.number().finite().min(0), duration: z.number().finite().positive().max(12)})).min(1).max(8),
  observations: z.array(z.object({type: z.string().max(80), trackId: z.string().max(120).optional(), at: z.number().finite().min(0).optional(), x: z.number().min(0).max(1).optional(), y: z.number().min(0).max(1).optional()})).max(60),
});
function base64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
async function boundedForm(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("Send incident video segments.");
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let total = 0;
  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > 12_000_000) { await reader.cancel(); throw new ApiError("Incident clips must be under 12 MB.",413); }
    chunks.push(new Uint8Array(value));
  }
  return new Response(new Blob(chunks), {headers: {"Content-Type": request.headers.get("content-type") || ""}}).formData();
}
export async function POST(request: Request) {
  let incident: Incident | undefined, owner = "";
  try {
    const user = await identity(); owner = user.userId;
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) throw new ApiError("Cross-origin uploads are not allowed.", 403);
    if (!env.BUCKET) throw new ApiError("Incident video storage is unavailable.", 503);
    if (!request.headers.get("x-odin-ai-key") && !secret("GEMINI_API_KEY")) throw new ApiError("Connect Gemini before enabling incident analysis.", 428);
    if (Number(request.headers.get("content-length")) > 12_000_000) throw new ApiError("Incident clips must be under 12 MB.", 413);
    const form = await boundedForm(request);
    let raw: unknown;
    try { raw = JSON.parse(String(form.get("metadata") || "null")); } catch { throw new ApiError("Invalid incident metadata."); }
    const parsed = metadata.safeParse(raw);
    if (!parsed.success) throw new ApiError("Invalid incident metadata.");
    const body = parsed.data;
    if (body.segments.some((s, i) => i > 0 && (s.at <= body.segments[i-1].at || s.startedAt <= body.segments[i-1].startedAt))) throw new ApiError("Incident segments must be in chronological order.");
    const camera = await readOne(owner, "cameras", body.cameraId);
    if (!camera || camera.source === "demo") throw new ApiError("Choose a connected camera.");
    const previous = await readOne<Incident>(owner, "incidents", body.id);
    if (previous) return Response.json({incident: previous, executions: []});
    const files = form.getAll("clips");
    if (files.length !== body.segments.length || files.some(f => !(f instanceof File))) throw new ApiError("Every video segment needs a file.");
    if (files.reduce((n, f) => n + (f as File).size, 0) > 10_000_000 || body.segments.reduce((n,s) => n + s.duration, 0) > 60) throw new ApiError("Use at most 60 seconds and 10 MB of incident evidence.", 413);
    const buffers = await Promise.all((files as File[]).map(async file => {
      const mime = file.type.split(";")[0];
      const bytes = new Uint8Array(await file.arrayBuffer());
      const valid = mime === "video/webm" ? bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3 : mime === "video/mp4" && String.fromCharCode(...bytes.subarray(4,8)) === "ftyp";
      if (!valid || bytes.length > 3_000_000 || bytes.length < 16) throw new ApiError("Use valid WebM or MP4 video segments under 3 MB.");
      return {bytes, mime};
    }));
    const settings = await readOne(owner, "settings", "workspace");
    const limit = settings?.aiChecksPerHour ?? 12;
    const now = Date.now();
    incident = {id: body.id, cameraId: body.cameraId, sessionId: body.sessionId, timestamp: now, reason: body.reason, status: "pending", recordingIds: [], summary: "Awaiting Gemini verification."};
    const reservation = await env.DB!.prepare("INSERT OR IGNORE INTO records (id,owner,kind,data,created_at,updated_at) VALUES (?,?,'incidents',?,?,?)").bind(incident.id, owner, JSON.stringify(incident), now, now).run();
    if (!reservation.meta.changes) return Response.json({incident: await readOne(owner, "incidents", incident.id), executions: []});
    const claim = await env.DB!.prepare("INSERT INTO records (id,owner,kind,data,created_at,updated_at) VALUES (?,?,'ai_budgets',?, ?, ?) ON CONFLICT(owner,kind,id) DO UPDATE SET data=json_set(records.data,'$.count',json_extract(records.data,'$.count')+1),updated_at=excluded.updated_at WHERE json_extract(records.data,'$.count') < ? RETURNING id")
      .bind(`${body.cameraId}:${Math.floor(now / 3600000)}`, owner, '{"count":1}', now, now, limit).first();
    if (!claim) {
      incident.status = "skipped"; incident.summary = "Automatic analysis limit reached for this camera this hour.";
      await save(owner, "incidents", incident);
      return Response.json({incident, executions: []});
    }
    await save(owner, "incidents", incident);
    const video = [];
    for (let i = 0; i < buffers.length; i++) {
      const id = crypto.randomUUID(), segment = body.segments[i], file = buffers[i];
      await env.BUCKET.put(`${owner}/${id}`, file.bytes, {httpMetadata: {contentType: file.mime}});
      try {
        await save(owner, "recordings", {id, cameraId: camera.id, name: `${camera.name} · incident segment ${i + 1}`, url: `/api/media/${id}`, startedAt: segment.startedAt, endedAt: segment.startedAt + segment.duration * 1000, sourceOffset: segment.at, duration: segment.duration, sessionId: body.sessionId});
      } catch (error) { await env.BUCKET.delete(`${owner}/${id}`); throw error; }
      incident.recordingIds.push(id);
      video.push({data: base64(file.bytes), mime: file.mime, at: segment.at});
    }
    await save(owner, "incidents", incident);
    const result = await analyzeScene(owner, camera.id, request, {video, observations: body.observations, sessionId: body.sessionId, sourceTime: body.segments[0].at, incidentId: incident.id, prompt: `Trigger: ${body.reason}`});
    incident.status = result.events.some(e => e.matchedRuleIds?.length) ? "verified" : "uncertain";
    incident.summary = result.summary; incident.model = result.model;
    await save(owner, "incidents", incident);
    return Response.json({...result, incident});
  } catch (error) {
    if (incident && owner) {
      incident.status = "failed";
      incident.summary = error instanceof ApiError ? error.message : "Incident analysis failed. Retry with manual analysis.";
      try { await save(owner, "incidents", incident); } catch { /* Original failure is reported below. */ }
    }
    return fail(error);
  }
}
