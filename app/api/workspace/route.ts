import { demoCameras, demoWorkflow } from "@/lib/demo";
import { save } from "@/lib/server";
import {
  identity,
  ensureSeed,
  readAll,
  readOne,
  fail,
  secret,
} from "@/lib/server";
import { env } from "cloudflare:workers";
export async function GET() {
  try {
    const user = await identity();
    await ensureSeed(user.userId);
    const settings = await readOne(user.userId, "settings", "workspace");
    // Upgrade only built-in demonstration records; never replace user camera sources.
    const cameraRecords = await readAll(user.userId, "cameras");
    for (const camera of cameraRecords.filter(
      (c) => c.source === "demo" && !c.url,
    )) {
      const upgraded = demoCameras.find((c) => c.id === camera.id);
      if (upgraded) {
        await save(user.userId, "cameras", {
          ...upgraded,
          createdAt: camera.createdAt,
        });
        const flow = demoWorkflow(upgraded);
        if (!(await readOne(user.userId, "workflows", flow.id)))
          await save(user.userId, "workflows", flow);
      }
    }
    // Enforce retention on every workspace load, including inactive camera histories.
    const cutoff = Date.now() - (settings?.retention || 30) * 86400000;
    await env
      .DB!.prepare(
        "DELETE FROM records WHERE owner = ? AND kind = 'events' AND json_extract(data,'$.timestamp') < ?",
      )
      .bind(user.userId, cutoff)
      .run();
    // Clip metadata and storage follow the same retention window as observations.
    const expired = await env
      .DB!.prepare(
        "SELECT id FROM records WHERE owner=? AND kind='recordings' AND json_extract(data,'$.endedAt')<? LIMIT 100",
      )
      .bind(user.userId, cutoff)
      .all<{ id: string }>();
    for (const clip of expired.results) {
      if (env.BUCKET) await env.BUCKET.delete(`${user.userId}/${clip.id}`);
      await env
        .DB!.prepare(
          "DELETE FROM records WHERE owner=? AND kind='recordings' AND id=?",
        )
        .bind(user.userId, clip.id)
        .run();
    }
    const kinds = [
      "cameras",
      "events",
      "workflows",
      "integrations",
      "faces",
      "executions",
      "messages",
      "reports",
      "recordings",
    ];
    const results = await Promise.all(
      kinds.map((k) => readAll(user.userId, k)),
    );
    return Response.json(
      {
        ...Object.fromEntries(kinds.map((k, i) => [k, results[i]])),
        settings,
        user: { name: user.displayName, email: user.email },
        capabilities: {
          ai: !!secret("GEMINI_API_KEY"),
          email: !!secret("RESEND_API_KEY") && !!secret("ALERT_FROM_EMAIL"),
          sms: !!secret("TWILIO_AUTH_TOKEN"),
          call: !!secret("VAPI_API_KEY"),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
