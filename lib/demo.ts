import type { Camera, Event, Workflow } from "./types";
/** Recorded demonstration footage and explicitly scripted playback annotations. */
export const demoCameras: Camera[] = [
  {
    id: "cam-001",
    name: "Warehouse Bay 1",
    location: "Dock B",
    category: "Warehouse",
    source: "demo",
    url: "/demo/warehouse.mp4",
    thumbnail: "/demo/warehouse.jpg",
    status: "online",
    enabled: true,
    createdAt: 0,
  },
  {
    id: "cam-002",
    name: "Mall Sector A",
    location: "North-East Corner",
    category: "Retail",
    source: "demo",
    url: "/demo/mall.mp4",
    thumbnail: "/demo/mall.jpg",
    status: "online",
    enabled: true,
    createdAt: 0,
  },
  {
    id: "cam-003",
    name: "Living Room",
    location: "Home",
    category: "Home",
    source: "demo",
    url: "/demo/room.mp4",
    thumbnail: "/demo/room.jpg",
    status: "online",
    enabled: true,
    createdAt: 0,
  },
  {
    id: "cam-004",
    name: "Retail Store",
    location: "Sunnyvale Mall",
    category: "Retail",
    source: "demo",
    url: "/demo/retail.mp4",
    thumbnail: "/demo/retail.jpg",
    status: "online",
    enabled: true,
    createdAt: 0,
  },
  {
    id: "cam-005",
    name: "Elderly Care Room 101",
    location: "Sunnyvale Home",
    category: "Healthcare",
    source: "demo",
    url: "/demo/elder.mp4",
    thumbnail: "/demo/elder.jpg",
    status: "online",
    enabled: true,
    createdAt: 0,
  },
  {
    id: "cam-006",
    name: "Manufacturing Line 3",
    location: "Chengdu Factory",
    category: "Industrial",
    source: "demo",
    url: "/demo/production.mp4",
    thumbnail: "/demo/production.jpg",
    status: "online",
    enabled: true,
    createdAt: 0,
  },
];
const scripts: Record<string, [number, string, Event["severity"], string][]> = {
  "cam-001": [
    [
      0,
      "Several people are standing and moving around in a warehouse.",
      "info",
      "person",
    ],
    [
      4,
      "People are grouped around a table and near stacks of boxes.",
      "info",
      "person",
    ],
  ],
  "cam-002": [
    [
      8,
      "A person enters the main floor area from the top left.",
      "info",
      "person",
    ],
    [
      16,
      "The person exits to the right, leaving a backpack unattended.",
      "warning",
      "unattended_bag",
    ],
    [
      23,
      "A person approaches the unattended backpack.",
      "warning",
      "approaching_bag",
    ],
    [
      27,
      "The person picks up the unattended backpack.",
      "critical",
      "bag_pickup",
    ],
  ],
  "cam-004": [
    [0, "People are seen on both sides of a counter.", "warning", "person"],
    [
      2,
      "A physical struggle is visible near the counter.",
      "critical",
      "physical_struggle",
    ],
    [4, "A person jumps over the counter.", "critical", "counter_crossing"],
    [
      6,
      "A person behind the counter is opening drawers.",
      "critical",
      "drawer_opening",
    ],
  ],
};
export function demoTimeline(cameraId: string): Event[] {
  return (
    scripts[cameraId] || [
      [0, "Demonstration video is playing.", "info", "scene"],
    ]
  ).map(([at, title, severity, type], i) => ({
    id: `playback-${cameraId}-${i}`,
    cameraId,
    title,
    description: title,
    severity,
    type,
    confidence: 0.95,
    timestamp: 0,
    sourceTime: at,
    acknowledged: false,
    demo: true,
    origin: "demo",
  }));
}
export function demoWorkflow(camera: Camera): Workflow {
  const mall = camera.id === "cam-002";
  const cls = mall
    ? "bag_pickup"
    : camera.id === "cam-004"
      ? "physical_struggle"
      : "person";
  return {
    id: `demo-flow-${camera.id}`,
    name: `${camera.name} workflow`,
    description:
      "Demonstration workflow. Browser alerts can be tested without provider credentials.",
    enabled: false,
    createdAt: Date.now(),
    nodes: [
      {
        id: "video",
        type: "input",
        title: "Video Input",
        description: camera.name,
        cameraId: camera.id,
        x: 60,
        y: 150,
      },
      {
        id: "rule-a",
        type: "rule",
        title: "Detection Rule",
        description: mall
          ? "A person picks up an unattended bag"
          : camera.id === "cam-004"
            ? "A physical struggle is visible"
            : "A person is present",
        ruleMode: "semantic",
        detectionClass: cls,
        x: 360,
        y: 60,
      },
      {
        id: "rule-b",
        type: "rule",
        title: "Detection Rule",
        description: mall
          ? "A bag is left unattended"
          : "Activity near the counter",
        ruleMode: "semantic",
        detectionClass: mall ? "unattended_bag" : "drawer_opening",
        x: 360,
        y: 240,
      },
      {
        id: "notify",
        type: "action",
        title: "Action",
        description: "Notify the operator",
        action: "browser",
        cooldown: 60,
        x: 680,
        y: 60,
      },
      {
        id: "speak",
        type: "action",
        title: "Action",
        description: "Speak the event summary",
        action: "voice",
        cooldown: 60,
        x: 680,
        y: 240,
      },
    ],
    edges: [
      { id: "a", source: "video", target: "rule-a" },
      { id: "b", source: "video", target: "rule-b" },
      { id: "c", source: "rule-a", target: "notify" },
      { id: "d", source: "rule-a", target: "speak" },
      { id: "e", source: "rule-b", target: "notify" },
    ],
  };
}
