import { z } from "zod";
import { OBJECT_CLASSES } from "./detection-options.ts";
const id = z.string().min(1).max(120);
const short = z.string().trim().min(1).max(160);
const text = z.string().max(5000);
export const cameraSchema = z.object({
  id,
  name: short,
  location: z.string().max(160),
  category: short,
  source: z.enum(["demo", "url", "upload", "webcam"]),
  url: z.string().max(2000),
  thumbnail: z.string().max(300000),
  status: z.enum(["online", "offline"]),
  enabled: z.boolean(),
  createdAt: z.number(),
});
export const nodeSchema = z.object({
  id,
  type: z.enum(["input", "rule", "action"]),
  title: short,
  description: text,
  x: z.number().min(-5000).max(10000),
  y: z.number().min(-5000).max(10000),
  cameraId: id.optional(),
  detectionClass: z.string().max(80).optional(),
  ruleMode: z.enum(["object", "semantic", "spatial"]).optional(),
  spatial: z.object({
    kind: z.enum(["zone_enter", "zone_exit", "line_cross", "dwell"]),
    points: z.array(z.object({x: z.number().min(0).max(1), y: z.number().min(0).max(1)})).min(2).max(12),
    seconds: z.number().int().min(1).max(3600).optional(),
    direction: z.enum(["either", "positive", "negative"]).optional(),
  }).optional(),
  action: z
    .enum(["browser", "voice", "email", "sms", "call", "webhook", "mcp"])
    .optional(),
  destination: z.string().max(1000).optional(),
  integrationId: id.optional(),
  toolArguments: z.string().max(5000).optional(),
  cooldown: z.number().min(30).max(86400).optional(),
});
export const workflowSchema = z
  .object({
    id,
    name: short,
    description: text,
    enabled: z.boolean(),
    nodes: z.array(nodeSchema).max(50),
    edges: z.array(z.object({ id, source: id, target: id })).max(100),
    createdAt: z.number(),
  })
  .superRefine((flow, ctx) => {
    for (const node of flow.nodes) {
      if (node.ruleMode === "spatial") {
        const r = node.spatial;
        if (node.detectionClass && node.detectionClass !== "*" && !OBJECT_CLASSES.some(c => c === node.detectionClass)) ctx.addIssue({code: "custom", message: "Spatial rules require a supported object category or Any event. Use person for person movement; face/motion events do not have object tracks."});
        if (!r || (r.kind === "line_cross" ? r.points.length !== 2 : r.points.length < 3))
          ctx.addIssue({code: "custom", message: "Draw a polygon for a zone or two distinct points for a crossing line."});
        if (r && r.kind !== "line_cross" && Math.abs(r.points.reduce((area, p, i) => { const q = r.points[(i+1) % r.points.length]; return area + p.x*q.y - q.x*p.y; },0)) < 0.00001)
          ctx.addIssue({code: "custom", message: "A zone must enclose an area."});
        if (r && r.points.every(p => p.x === r.points[0].x && p.y === r.points[0].y))
          ctx.addIssue({code: "custom", message: "The rule geometry must have distinct points."});
      }
    }
    const ids = new Set(flow.nodes.map((n) => n.id));
    if (ids.size !== flow.nodes.length)
      ctx.addIssue({ code: "custom", message: "Node IDs must be unique." });
    for (const edge of flow.edges) {
      const from = flow.nodes.find((n) => n.id === edge.source),
        to = flow.nodes.find((n) => n.id === edge.target);
      if (
        !from ||
        !to ||
        from.type === "action" ||
        to.type === "input" ||
        edge.source === edge.target
      )
        ctx.addIssue({
          code: "custom",
          message: "Connect inputs to rules and rules to actions.",
        });
    }
    const colors = new Map<string, number>();
    const visit = (n: string): boolean => {
      if (colors.get(n) === 1) return true;
      if (colors.get(n) === 2) return false;
      colors.set(n, 1);
      for (const e of flow.edges.filter((e) => e.source === n))
        if (visit(e.target)) return true;
      colors.set(n, 2);
      return false;
    };
    if (flow.nodes.some((n) => visit(n.id)))
      ctx.addIssue({
        code: "custom",
        message: "Workflows cannot contain a cycle.",
      });
    if (new Set(flow.edges.map((e) => e.id)).size !== flow.edges.length)
      ctx.addIssue({
        code: "custom",
        message: "Connection IDs must be unique.",
      });
    if (
      flow.enabled &&
      (!flow.nodes.some((n) => n.type === "input") ||
        !flow.nodes.some((n) => n.type === "action") ||
        !flow.edges.length)
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Connect a camera input to at least one action before activating.",
      });
  });
export const integrationSchema = z.object({
  id,
  name: short,
  type: z.enum(["slack", "discord", "webhook", "mcp", "email", "sms", "call"]),
  endpoint: z.string().max(2000),
  enabled: z.boolean(),
  tools: z
    .array(
      z.object({
        name: short,
        description: text.optional(),
        inputSchema: z.unknown().optional(),
      }),
    )
    .max(100)
    .optional(),
  status: z.string().max(100).optional(),
});
export const faceSchema = z.object({
  id,
  name: short,
  role: z.string().max(100),
  embedding: z.array(z.number().finite()).min(128).max(2048),
  thumbnail: z.string().max(300000),
  createdAt: z.number(),
});
export const settingsSchema = z.object({
  id: z.literal("workspace"),
  workspaceName: short,
  notifications: z.boolean(),
  voice: z.boolean(),
  confidence: z.number().min(0.3).max(0.99),
  retention: z.number().int().min(1).max(365),
  detectionQuality: z.enum(["balanced", "detail"]).optional(),
  aiChecksPerHour: z.number().int().min(1).max(120).optional(),
  fallbackModel: z.string().trim().max(160).regex(/^(gemini-[a-zA-Z0-9.-]+)?$/).optional(),
  model: short.regex(/^gemini-[a-zA-Z0-9.-]+$/, "Enter a Gemini model ID, for example gemini-3.5-flash-lite."),
});
const trackPosition = z.object({
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
  at: z.number().finite().min(0),
});
export const eventInput = z.object({
  cameraId: id,
  title: short,
  description: text,
  severity: z.enum(["info", "warning", "critical"]),
  type: short,
  confidence: z.number().min(0).max(1),
  snapshot: z.string().max(300000).optional(),
  sourceTime: z.number().finite().min(0).optional(),
  sessionId: id.optional(),
  personId: id.optional(),
  personName: z.string().max(160).optional(),
  trackId: id.optional(),
  firstSeen: z.number().finite().min(0).optional(),
  observationCount: z.number().int().min(1).max(100000000).optional(),
  position: trackPosition.optional(),
  movement: z.object({direction: z.string().max(30), framePercentPerSecond: z.number().finite().min(0).max(10000)}).optional(),
  trail: z.array(trackPosition).max(120).optional(),
});
