import { env } from "cloudflare:workers";
import { identity, fail, ApiError } from "@/lib/server";
export async function GET(request: Request) {
  try {
    const u = await identity();
    const params = new URL(request.url).searchParams;
    const q = (params.get("q") || "").trim().slice(0, 200);
    const camera = params.get("camera") || "";
    const person = params.get("person") || "";
    const from = params.get("from") ? Number(params.get("from")) : 0,
      to = params.get("to") ? Number(params.get("to")) : Date.now() + 60000;
    if (!Number.isFinite(from) || !Number.isFinite(to) || from > to)
      throw new ApiError("Choose a valid date range.");
    const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    const rows = await env
      .DB!.prepare(
        "SELECT data FROM records WHERE owner=? AND kind='events' AND (?='' OR data LIKE ? ESCAPE '\\') AND (?='' OR json_extract(data,'$.cameraId')=?) AND (?='' OR json_extract(data,'$.personId')=?) AND COALESCE(json_extract(data,'$.lastSeen'),json_extract(data,'$.timestamp'))>=? AND COALESCE(json_extract(data,'$.firstSeen'),json_extract(data,'$.timestamp'))<=? ORDER BY json_extract(data,'$.timestamp') DESC LIMIT 200",
      )
      .bind(u.userId, q, pattern, camera, camera, person, person, from, to)
      .all<{ data: string }>();
    return Response.json(
      { events: rows.results.map((r) => JSON.parse(r.data)), limit: 200 },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
