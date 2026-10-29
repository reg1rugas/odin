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
    // Enforce retention on every workspace load, including inactive camera histories.
    const cutoff = Date.now() - (settings?.retention || 30) * 86400000;
    await env
      .DB!.prepare(
        "DELETE FROM records WHERE owner = ? AND kind = 'events' AND json_extract(data,'$.timestamp') < ?",
      )
      .bind(user.userId, cutoff)
      .run();
    const kinds = [
      "cameras",
      "events",
      "workflows",
      "integrations",
      "faces",
      "executions",
      "messages",
      "reports",
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
