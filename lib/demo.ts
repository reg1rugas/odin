import type { Camera, Event, Workflow } from "./types";
/** Recorded demonstration footage and explicitly scripted playback annotations. */
export const demoCameras: Camera[] = [
  {
    id: "cam-001",
    name: "Warehouse Aisle",
    location: "Inventory · Aisle 01",
    category: "Warehouse",
    source: "demo",
    demoRevision: 2,
    url: "/demo/warehouse-v2.mp4",
    thumbnail: "/demo/warehouse-v2.jpg",
    status: "online",
    enabled: true,
    createdAt: 0,
  },
  {
    id: "cam-002",
    name: "Mall Concourse",
    location: "Atrium · Upper Level",
    category: "Retail",
    source: "demo",
    demoRevision: 2,
    url: "/demo/mall-v2.mp4",
    thumbnail: "/demo/mall-v2.jpg",
    status: "online",
    enabled: true,
    createdAt: 0,
  },
  {
    id: "cam-003",
    name: "Park Promenade",
    location: "Shared walking & cycling path",
    category: "Outdoor",
    source: "demo",
    demoRevision: 2,
    url: "/demo/park-v2.mp4",
    thumbnail: "/demo/park-v2.jpg",
    status: "online",
    enabled: true,
    createdAt: 0,
  },
  {
    id: "cam-004",
    name: "Supermarket Aisle",
    location: "Grocery · Chilled Section",
    category: "Retail",
    source: "demo",
    demoRevision: 2,
    url: "/demo/retail-v2.mp4",
    thumbnail: "/demo/retail-v2.jpg",
    status: "online",
    enabled: true,
    createdAt: 0,
  },
  {
    id: "cam-005",
    name: "City Intersection",
    location: "Street · Traffic Approach",
    category: "Traffic",
    source: "demo",
    demoRevision: 2,
    url: "/demo/traffic-v2.mp4",
    thumbnail: "/demo/traffic-v2.jpg",
    status: "online",
    enabled: true,
    createdAt: 0,
  },
  {
    id: "cam-006",
    name: "Factory Workshop",
    location: "Machining · Lathe Station",
    category: "Industrial",
    source: "demo",
    demoRevision: 2,
    url: "/demo/factory-v2.mp4",
    thumbnail: "/demo/factory-v2.jpg",
    status: "online",
    enabled: true,
    createdAt: 0,
  },
];
const scripts: Record<string, [number, string, Event["severity"], string][]> = {
  "cam-001": [
    [0, "A worker is visible between the warehouse racks.", "info", "person"],
    [1.5, "Another worker moves a pallet jack across the aisle.", "info", "person"],
    [7, "A worker moves toward the foreground with a tablet.", "info", "person"],
  ],
  "cam-002": [
    [0, "Shoppers are visible throughout the mall concourse.", "info", "person"],
    [4, "People move along the upper-level walkway.", "info", "person"],
    [10, "Foot traffic continues around the atrium.", "info", "person"],
  ],
  "cam-003": [
    [0, "A cyclist and a pedestrian share the park path.", "info", "person"],
    [1, "Bicycles travel along the tree-lined promenade.", "info", "bicycle"],
    [5, "A dog is visible beside a person in the foreground.", "info", "dog"],
  ],
  "cam-004": [
    [0, "A shopper browses the chilled grocery shelves.", "info", "person"],
    [2, "The shopper reaches toward products on the shelf.", "info", "person"],
    [5, "The shopper moves farther down the aisle.", "info", "person"],
  ],
  "cam-005": [
    [0, "Pedestrians are visible beside the intersection.", "info", "person"],
    [4, "A car enters the foreground of the street view.", "info", "car"],
    [11, "A bus passes through the background.", "info", "bus"],
  ],
  "cam-006": [
    [0, "A worker is visible at the lathe station.", "info", "person"],
    [5, "The worker adjusts the machinery at the workstation.", "info", "person"],
    [11, "The worker continues operating at the same station.", "info", "person"],
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
  const secondary = camera.id === "cam-003" ? "bicycle" : camera.id === "cam-005" ? "car" : "person";
  return {
    id: `demo-flow-${camera.id}`,
    name: `${camera.name} workflow`,
    description:
      "Recorded detection preview. Playback highlights the graph without sending notifications.",
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
        description: "A person is visible in the camera frame",
        ruleMode: "object",
        detectionClass: "person",
        x: 360,
        y: 60,
      },
      {
        id: "rule-b",
        type: "rule",
        title: "Detection Rule",
        description: secondary === "person" ? "Person activity in the monitored area" : `A ${secondary} is visible in the camera frame`,
        ruleMode: "object",
        detectionClass: secondary,
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

/** Refresh built-in footage only; retain user-added cameras and local preferences. */
export function upgradeDemoCamera(camera: Camera): Camera | null {
  const current = demoCameras.find(sample => sample.id === camera.id);
  if (camera.source !== "demo" || !current || camera.demoRevision === current.demoRevision) return null;
  return {...camera, ...current, createdAt: camera.createdAt, enabled: camera.enabled};
}

export function seedDemoEvents(now: number): Event[] {
  return demoCameras.flatMap((camera, cameraIndex) => demoTimeline(camera.id).map((event, index) => ({
    ...event,
    id: `evt-sample-v2-${camera.id}-${index}`,
    timestamp: now - (cameraIndex * 3 + index + 1) * 60000,
  })));
}

// Exact fingerprints of the six original sample templates, excluding creation time.
// Any user edit changes the fingerprint and prevents replacement.
const legacyWorkflowHashes: Record<string, string> = {
  "demo-flow-cam-001": "7021902cf1050ee2a76e046364291c5d17c6d189bd9dc49703f4b4d92a806514",
  "demo-flow-cam-002": "00b43f94a447494cfb3ada23bf4aa3543e4e20a870fc16be28e3f7917380aca0",
  "demo-flow-cam-003": "88879463a872847c0e0b8e48c5e3c670c8ccaa13b00f17c9085e3bd1a4e58b81",
  "demo-flow-cam-004": "363b5e97f01f2c6338576d80a13380c37ca4297d31b0106ee031b625e03b0301",
  "demo-flow-cam-005": "a54d1783eaba6805ecd564be208fc92850308b1178cd51aeb78a246c177e0486",
  "demo-flow-cam-006": "31fbca3424c8207f18c9590ec8f18944afe7bc127f162e42a5cd7cc9ad13a171"
};
export async function isUntouchedLegacyDemoWorkflow(workflow: Workflow): Promise<boolean> {
  const expected = legacyWorkflowHashes[workflow.id];
  if (!expected || workflow.enabled) return false;
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object")
      return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, canonical(item)]));
    return value;
  };
  const {createdAt: _createdAt, ...content} = workflow;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(canonical(content))));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("") === expected;
}
