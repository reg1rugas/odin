export type Camera = {
  id: string;
  name: string;
  location: string;
  category: string;
  source: "demo" | "url" | "upload" | "webcam";
  url: string;
  thumbnail: string;
  status: "online" | "offline";
  enabled: boolean;
  createdAt: number;
};
export type Event = {
  id: string;
  cameraId: string;
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
  type: string;
  confidence: number;
  timestamp: number;
  acknowledged: boolean;
  demo?: boolean;
  snapshot?: string;
};
export type FlowNode = {
  id: string;
  type: "input" | "rule" | "action";
  title: string;
  description: string;
  x: number;
  y: number;
  cameraId?: string;
  detectionClass?: string;
  action?: string;
  destination?: string;
  integrationId?: string;
  cooldown?: number;
  toolArguments?: string;
};
export type Edge = { id: string; source: string; target: string };
export type Workflow = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  nodes: FlowNode[];
  edges: Edge[];
  createdAt: number;
};
export type Integration = {
  id: string;
  name: string;
  type: "slack" | "discord" | "webhook" | "mcp" | "email" | "sms" | "call";
  endpoint: string;
  enabled: boolean;
  tools?: { name: string; description?: string; inputSchema?: unknown }[];
  status?: string;
};
export type Person = {
  id: string;
  name: string;
  role: string;
  embedding: number[];
  thumbnail: string;
  createdAt: number;
};
export type Execution = {
  id: string;
  workflowId: string;
  workflowName: string;
  eventId: string;
  eventTitle: string;
  timestamp: number;
  status: "success" | "failed" | "partial" | "pending";
  results: {
    nodeId: string;
    action: string;
    status: "success" | "failed" | "pending";
    message: string;
  }[];
};
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  cameraIds: string[];
  timestamp: number;
};
export type Report = {
  id: string;
  title: string;
  from: number;
  to: number;
  cameraIds: string[];
  createdAt: number;
  summary: string;
  eventCount: number;
};
export type Settings = {
  id: string;
  workspaceName: string;
  notifications: boolean;
  voice: boolean;
  confidence: number;
  retention: number;
  model: string;
};
export type Workspace = {
  cameras: Camera[];
  events: Event[];
  workflows: Workflow[];
  integrations: Integration[];
  faces: Person[];
  executions: Execution[];
  messages: ChatMessage[];
  reports: Report[];
  settings: Settings;
  user: { name: string; email: string };
  capabilities: { ai: boolean; email: boolean; sms: boolean; call: boolean };
};
