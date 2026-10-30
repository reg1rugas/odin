import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { seedWorkspace } from "./seed";
import { requestGemini, GeminiRequestError } from "./gemini-request";
import { DEFAULT_GEMINI_MODEL, resolveGeminiModel } from "./gemini-model";
import {
  matchingActions,
  executionStatus,
  traceWorkflow,
  workflowTriggerTitle,
} from "./workflow-engine";
import type { Event, Workflow, Execution, Integration } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function identity() {
  const user = await getChatGPTUser();
  if (!user) throw new ApiError("Sign in to access your Odin workspace.", 401);
  if (!env.DB)
    throw new ApiError("The workspace database is unavailable.", 503);
  return user;
}
export function fail(error: unknown) {
  if (!(error instanceof ApiError))
    console.error(
      "Odin request failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
  return Response.json(
    {
      error:
        error instanceof ApiError
          ? error.message
          : "The request could not be completed. Please try again.",
    },
    { status: error instanceof ApiError ? error.status : 500 },
  );
}
export async function readAll<T = any>(
  owner: string,
  kind: string,
): Promise<T[]> {
  const result = await env
    .DB!.prepare(
      "SELECT data FROM records WHERE owner = ? AND kind = ? ORDER BY CASE WHEN kind='events' THEN json_extract(data,'$.timestamp') ELSE created_at END DESC LIMIT 2000",
    )
    .bind(owner, kind)
    .all<{ data: string }>();
  return result.results.map((r) => JSON.parse(r.data));
}
/** Compact AI context is fetched in SQL so snapshots and trails never inflate Worker memory. */
export async function readCameraEvents(owner: string, cameraIds: string[], limit = 80): Promise<Event[]> {
  if (!cameraIds.length) return [];
  const placeholders = cameraIds.map(() => "?").join(",");
  const result = await env.DB!.prepare(`SELECT json_remove(data,'$.snapshot','$.trail','$.spatialState') AS data FROM records WHERE owner=? AND kind='events' AND json_extract(data,'$.cameraId') IN (${placeholders}) ORDER BY json_extract(data,'$.timestamp') DESC LIMIT ?`)
    .bind(owner, ...cameraIds, Math.max(1,Math.min(80,limit))).all<{data: string}>();
  return result.results.map(row => JSON.parse(row.data));
}
/** Join legacy executions to their event; new executions retain the exact trigger position in the video. */
export async function readCameraAlerts(owner: string, cameraIds: string[], limit = 20): Promise<Execution[]> {
  if (!cameraIds.length) return [];
  const placeholders = cameraIds.map(() => "?").join(",");
  const result = await env.DB!.prepare(`SELECT x.data, json_extract(e.data,'$.cameraId') AS cameraId FROM records x LEFT JOIN records e ON e.owner=x.owner AND e.kind='events' AND e.id=json_extract(x.data,'$.eventId') WHERE x.owner=? AND x.kind='executions' AND COALESCE(json_extract(x.data,'$.cameraId'),json_extract(e.data,'$.cameraId')) IN (${placeholders}) ORDER BY json_extract(x.data,'$.timestamp') DESC LIMIT ?`)
    .bind(owner, ...cameraIds, Math.max(1,Math.min(40,limit))).all<{data: string; cameraId: string | null}>();
  return result.results.map(row => {const alert = JSON.parse(row.data); return {...alert, cameraId: alert.cameraId ?? row.cameraId ?? undefined};});
}
export async function readOne<T = any>(
  owner: string,
  kind: string,
  id: string,
): Promise<T | null> {
  const r = await env
    .DB!.prepare(
      "SELECT data FROM records WHERE owner = ? AND kind = ? AND id = ?",
    )
    .bind(owner, kind, id)
    .first<{ data: string }>();
  return r ? JSON.parse(r.data) : null;
}
export async function save(
  owner: string,
  kind: string,
  data: { id: string; [key: string]: any },
) {
  const now = Date.now();
  await env
    .DB!.prepare(
      "INSERT INTO records (id, owner, kind, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(owner, kind, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
    )
    .bind(data.id, owner, kind, JSON.stringify(data), now, now)
    .run();
  return data;
}
export async function ensureSeed(owner: string) {
  const existing = await readOne(owner, "settings", "workspace");
  if (existing) {
    const model = resolveGeminiModel(existing.model);
    if (model !== existing.model) {
      await save(owner, "settings", { ...existing, model });
    }
    return;
  }
  const seed = seedWorkspace();
  const now = Date.now();
  const settings = {
    id: "workspace",
    workspaceName: "Odin workspace",
    notifications: true,
    voice: false,
    confidence: 0.5,
    retention: 30,
    model: DEFAULT_GEMINI_MODEL,
  };
  await env.DB!.batch([
    ...Object.entries(seed).flatMap(([kind, values]) =>
      values.map((data) =>
        env
          .DB!.prepare(
            "INSERT OR IGNORE INTO records (id, owner, kind, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
          )
          .bind(data.id, owner, kind, JSON.stringify(data), now, now),
      ),
    ),
    env
      .DB!.prepare(
        "INSERT OR IGNORE INTO records (id, owner, kind, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(settings.id, owner, "settings", JSON.stringify(settings), now, now),
  ]);
}
export function secret(name: string): string {
  return (env as unknown as Record<string, string>)[name] || "";
}
export async function jsonBody(request: Request, max = 2_000_000) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new ApiError("Cross-origin writes are not allowed.", 403);
  const body = await request.text();
  if (body.length > max) throw new ApiError("The request is too large.", 413);
  try {
    return JSON.parse(body);
  } catch {
    throw new ApiError("Invalid JSON.");
  }
}
export function safeEndpoint(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ApiError("Enter a valid HTTPS endpoint.");
  }
  const h = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !h.includes(".") ||
    /(^|\.)(localhost|local|internal|test|invalid)$/.test(h) ||
    /^[\d.]+$/.test(h) ||
    h.includes(":") ||
    h.includes("[")
  )
    throw new ApiError("Use a public HTTPS hostname on port 443.");
  return url.toString();
}
export async function gemini(
  owner: string,
  prompt: string,
  request?: Request,
  image?: string | { image: string; at: number }[],
  json = false,
  video?: { data: string; mime: string; at: number }[],
  context?: { incidentId?: string; feature?: string; onModel?: (model: string) => void },
) {
  const key = request?.headers.get("x-odin-ai-key") || secret("GEMINI_API_KEY");
  if (!key)
    throw new ApiError(
      "Connect Gemini in Settings to use visual reasoning and AI generation.",
      428,
    );
  const settings = await readOne(owner, "settings", "workspace");
  const model = resolveGeminiModel(settings?.model);
  const parts: any[] = [{ text: prompt }];
  if (image) {
    const frames = typeof image === "string" ? [{ image, at: 0 }] : image;
    if (frames.length > 6)
      throw new ApiError("Use at most six frames per analysis.");
    for (const frame of frames) {
      const match =
        /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(
          frame.image,
        );
      if (!match || frame.image.length > 1_500_000)
        throw new ApiError("Use a JPEG, PNG, or WebP frame under 1 MB.");
      parts.push({ text: `Camera time: ${frame.at.toFixed(2)} seconds.` });
      parts.push({
        inline_data: { mime_type: `image/${match[1]}`, data: match[2] },
      });
    }
  }
  if (video) {
    if (video.length > 8 || video.some(v => !["video/webm", "video/mp4"].includes(v.mime) || v.data.length > 4_000_000 || !/^[A-Za-z0-9+/=]+$/.test(v.data)))
      throw new ApiError("Use at most eight small video segments.");
    for (const clip of video) {
      parts.push({text: `Segment starts at camera time ${clip.at.toFixed(2)} seconds. Treat segments as one ordered incident.`});
      parts.push({inline_data: {mime_type: clip.mime, data: clip.data}});
    }
  }
  const call = async (selected: string) => {
    context?.onModel?.(selected);
    return requestGemini({ model: selected, key, parts, json, maxRetries: 2,
      onUsage: async (usage) => {
        try { await save(owner, "ai_usage", {id: crypto.randomUUID(), timestamp: Date.now(), model: selected, feature: context?.feature || (image || video ? "analysis" : "text"), incidentId: context?.incidentId, ...usage}); }
        catch { console.error("Could not save AI usage counters."); }
      },
    });
  };
  try {
    return await call(model);
  } catch (error) {
    if (error instanceof GeminiRequestError) {
      // Retry a different model only for service failures, not quotas, permissions or invalid input.
      if (settings?.fallbackModel && settings.fallbackModel !== model && [500, 502, 503, 504].includes(error.upstreamStatus || 0)) {
        try { return await call(resolveGeminiModel(settings.fallbackModel)); }
        catch (fallback) { if (fallback instanceof GeminiRequestError) throw new ApiError(fallback.message, fallback.status); throw fallback; }
      }
      throw new ApiError(error.message, error.status);
    }
    throw error;
  }
}
export async function mcpRequest(
  endpoint: string,
  method: string,
  params: any = {},
  session?: string,
) {
  const r = await fetch(safeEndpoint(endpoint), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(session
        ? { "Mcp-Session-Id": session, "MCP-Protocol-Version": "2025-03-26" }
        : {}),
      ...(secret("MCP_BEARER_TOKEN")
        ? { Authorization: `Bearer ${secret("MCP_BEARER_TOKEN")}` }
        : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method,
      params,
    }),
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new ApiError(`MCP server returned HTTP ${r.status}.`, 502);
  const raw = await r.text();
  let data: any;
  if (r.headers.get("content-type")?.includes("text/event-stream")) {
    const blocks = raw
      .split(/\r?\n/)
      .filter((x) => x.startsWith("data:"))
      .map((x) => {
        try {
          return JSON.parse(x.slice(5));
        } catch {
          return null;
        }
      });
    data = blocks.reverse().find((x) => x?.result || x?.error);
  } else {
    data = JSON.parse(raw);
  }
  if (data?.error)
    throw new ApiError(data.error.message || "MCP request failed.", 502);
  if (!data?.result)
    throw new ApiError("MCP server returned an unsupported response.", 502);
  return {
    result: data.result,
    session: r.headers.get("Mcp-Session-Id") || session,
  };
}
export async function initializeMcp(endpoint: string) {
  const init = await mcpRequest(endpoint, "initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "odin", version: "1.0.0" },
  });
  const response = await fetch(safeEndpoint(endpoint), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(init.session ? { "Mcp-Session-Id": init.session } : {}),
      "MCP-Protocol-Version": init.result.protocolVersion || "2025-03-26",
      ...(secret("MCP_BEARER_TOKEN")
        ? { Authorization: `Bearer ${secret("MCP_BEARER_TOKEN")}` }
        : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }),
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new ApiError(
      `MCP initialization returned HTTP ${response.status}.`,
      502,
    );
  return init;
}
async function externalAction(owner: string, node: any, event: Event) {
  const text = `${event.title}\n${event.description}\nOdin · ${new Date(event.timestamp).toISOString()}`;
  if (node.action === "browser" || node.action === "voice")
    return {
      message: "Ready for delivery in the active monitoring browser.",
      status: "pending" as const,
    };
  if (node.action === "email") {
    if (!secret("RESEND_API_KEY") || !secret("ALERT_FROM_EMAIL"))
      throw new Error("Configure RESEND_API_KEY and ALERT_FROM_EMAIL.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(node.destination || ""))
      throw new Error("Set a valid recipient email.");
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: secret("ALERT_FROM_EMAIL"),
        to: [node.destination],
        subject: `Odin alert: ${event.title}`,
        text,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`Email provider returned HTTP ${r.status}.`);
    return {
      message: "Email accepted by the provider.",
      status: "success" as const,
    };
  }
  if (node.action === "sms") {
    if (
      !secret("TWILIO_ACCOUNT_SID") ||
      !secret("TWILIO_AUTH_TOKEN") ||
      !secret("TWILIO_FROM_NUMBER")
    )
      throw new Error("Configure Twilio credentials and sender number.");
    if (!/^\+[1-9]\d{7,14}$/.test(node.destination || ""))
      throw new Error("Set an E.164 recipient phone number.");
    const sid = secret("TWILIO_ACCOUNT_SID");
    const r = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${sid}:${secret("TWILIO_AUTH_TOKEN")}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: node.destination,
          From: secret("TWILIO_FROM_NUMBER"),
          Body: text,
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!r.ok) throw new Error(`SMS provider returned HTTP ${r.status}.`);
    return {
      message: "SMS accepted by the provider.",
      status: "success" as const,
    };
  }
  if (node.action === "call") {
    if (!secret("VAPI_API_KEY") || !secret("VAPI_PHONE_NUMBER_ID"))
      throw new Error("Configure VAPI_API_KEY and VAPI_PHONE_NUMBER_ID.");
    if (!/^\+[1-9]\d{7,14}$/.test(node.destination || ""))
      throw new Error("Set an E.164 recipient phone number.");
    const r = await fetch("https://api.vapi.ai/call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret("VAPI_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phoneNumberId: secret("VAPI_PHONE_NUMBER_ID"),
        customer: { number: node.destination },
        assistant: {
          firstMessage: text,
          model: {
            provider: "openai",
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "Read the security alert clearly. Do not add facts.",
              },
            ],
          },
        },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`Call provider returned HTTP ${r.status}.`);
    return {
      message: "Voice call accepted by the provider.",
      status: "success" as const,
    };
  }
  const integration = await readOne<Integration>(
    owner,
    "integrations",
    node.integrationId,
  );
  if (!integration?.enabled)
    throw new Error("Select an enabled tool connection for this action.");
  if (node.action === "mcp") {
    const init = await initializeMcp(integration.endpoint);
    const result = await mcpRequest(
      integration.endpoint,
      "tools/call",
      {
        name: node.destination,
        arguments: JSON.parse(
          (node.toolArguments || '{"message":"{{message}}"}').replace(
            /"\{\{message\}\}"/g,
            JSON.stringify(text),
          ),
        ),
      },
      init.session,
    );
    if (result.result.isError) throw new Error("MCP tool reported an error.");
    return { message: "MCP tool completed.", status: "success" as const };
  }
  const r = await fetch(safeEndpoint(integration.endpoint), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      integration.type === "discord"
        ? { content: text }
        : integration.type === "slack"
          ? { text }
          : { source: "odin", event },
    ),
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`Webhook returned HTTP ${r.status}.`);
  return { message: "Webhook delivered.", status: "success" as const };
}
export async function runWorkflows(owner: string, event: Event, configured?: Workflow[]) {
  if (event.demo) return [];
  const workflows = configured || await readAll<Workflow>(owner, "workflows");
  const outputs: Execution[] = [];
  for (const flow of workflows.filter((f) => f.enabled)) {
    const actions = matchingActions(flow, event);
    if (!actions.length) continue;
    const execution: Execution = {
      id: crypto.randomUUID(),
      workflowId: flow.id,
      workflowName: flow.name,
      eventId: event.id,
      eventTitle: workflowTriggerTitle(flow, event),
      cameraId: event.cameraId,
      trackId: event.trackId,
      sourceTime: event.sourceTime,
      sessionId: event.sessionId,
      incidentId: event.incidentId,
      origin: event.origin,
      visitedNodes: traceWorkflow(flow, event),
      timestamp: Date.now(),
      status: "success",
      results: [],
    };
    for (const node of actions) {
      const key = `${flow.id}:${node.id}`;
      const now = Date.now();
      const until = now + Math.max(30, node.cooldown || 60) * 1000;
      const claim = await env
        .DB!.prepare(
          "INSERT INTO records (id, owner, kind, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(owner, kind, id) DO UPDATE SET updated_at = excluded.updated_at WHERE records.updated_at < ? RETURNING id",
        )
        .bind(key, owner, "cooldowns", "{}", now, until, now)
        .first();
      if (!claim) {
        if (event.matchedLocalRuleIds?.some(id => id.startsWith(`${flow.id}:`))) execution.results.push({nodeId: node.id, action: node.action || "webhook", status: "skipped", message: "Rule matched, but this action is still in its cooldown. No repeat alert was sent."});
        continue;
      }
      try {
        const result = await externalAction(owner, node, {...event, title: execution.eventTitle});
        execution.results.push({
          nodeId: node.id,
          action: node.action || "webhook",
          ...result,
        });
      } catch (e) {
        execution.results.push({
          nodeId: node.id,
          action: node.action || "webhook",
          status: "failed",
          message: e instanceof Error ? e.message : "Action failed.",
        });
      }
    }
    if (!execution.results.length) continue;
    execution.status = executionStatus(execution.results);
    await save(owner, "executions", execution);
    outputs.push(execution);
  }
  return outputs;
}
