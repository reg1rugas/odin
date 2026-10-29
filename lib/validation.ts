import { z } from "zod";
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
  model: short.regex(/^[a-zA-Z0-9.-]+$/),
});
export const eventInput = z.object({
  cameraId: id,
  title: short,
  description: text,
  severity: z.enum(["info", "warning", "critical"]),
  type: short,
  confidence: z.number().min(0).max(1),
  snapshot: z.string().max(300000).optional(),
});
