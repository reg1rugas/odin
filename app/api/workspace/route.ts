import { demoWorkflow, seedDemoEvents, upgradeDemoCamera, isUntouchedLegacyDemoWorkflow } from "@/lib/demo";
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
    // Version the built-in samples so existing workspaces receive new footage too.
    const cameraRecords = await readAll(user.userId, "cameras");
    const upgradedIds = new Set<string>();
    for (const camera of cameraRecords) {
      const upgraded = upgradeDemoCamera(camera);
      if (!upgraded) continue;
      await save(user.userId, "cameras", upgraded);
      upgradedIds.add(camera.id);
      const flow = demoWorkflow(upgraded);
      const existing = await readOne(user.userId, "workflows", flow.id);
      // Preserve activated or edited workflows; only refresh untouched sample templates.
      if (!existing || await isUntouchedLegacyDemoWorkflow(existing))
        await save(user.userId, "workflows", flow);
    }
    if (upgradedIds.size) {
      const events = await readAll(user.userId, "events");
      for (const event of events) {
        if (event.demo && event.id.startsWith("evt-demo-") && upgradedIds.has(event.cameraId))
          await env.DB!.prepare("DELETE FROM records WHERE owner=? AND kind='events' AND id=?").bind(user.userId, event.id).run();
      }
      for (const event of seedDemoEvents(Date.now()).filter(event => upgradedIds.has(event.cameraId)))
        await save(user.userId, "events", event);
    }
    // Enforce retention on every workspace load, including inactive camera histories.
    const cutoff = Date.now() - (settings?.retention || 30) * 86400000;
    await env
      .DB!.prepare(
        "DELETE FROM records WHERE owner = ? AND kind = 'events' AND json_extract(data,'$.timestamp') < ?",
      )
      .bind(user.userId, cutoff)
      .run();
    await env.DB!.prepare("DELETE FROM records WHERE owner=? AND kind IN ('incidents','ai_usage') AND json_extract(data,'$.timestamp')<?").bind(user.userId, cutoff).run();
    await env.DB!.prepare("DELETE FROM records WHERE owner=? AND kind='ai_budgets' AND updated_at<?").bind(user.userId, Date.now() - 3600000).run();
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
      "incidents",
      "ai_usage",
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
