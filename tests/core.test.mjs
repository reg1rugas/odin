import test from "node:test";
import assert from "node:assert/strict";
import { matchingActions, executionStatus } from "../lib/workflow-engine.ts";
import { workflowSchema, faceSchema } from "../lib/validation.ts";
import { makePdf } from "../lib/pdf.ts";

const flow = {
  id: "f",
  name: "Security",
  description: "Test graph",
  enabled: true,
  createdAt: 1,
  nodes: [
    {
      id: "in",
      type: "input",
      title: "Camera",
      description: "",
      cameraId: "cam1",
      x: 0,
      y: 0,
    },
    {
      id: "person",
      type: "rule",
      title: "Person",
      description: "",
      detectionClass: "person",
      x: 300,
      y: 0,
    },
    {
      id: "bag",
      type: "rule",
      title: "Bag",
      description: "",
      detectionClass: "backpack",
      x: 300,
      y: 200,
    },
    {
      id: "alert",
      type: "action",
      title: "Alert",
      description: "",
      action: "browser",
      x: 600,
      y: 0,
    },
    {
      id: "voice",
      type: "action",
      title: "Voice",
      description: "",
      action: "voice",
      x: 600,
      y: 200,
    },
  ],
  edges: [
    { id: "1", source: "in", target: "person" },
    { id: "2", source: "in", target: "bag" },
    { id: "3", source: "person", target: "alert" },
    { id: "4", source: "bag", target: "alert" },
    { id: "5", source: "bag", target: "voice" },
  ],
};
const event = {
  id: "e",
  cameraId: "cam1",
  title: "Person detected",
  description: "",
  type: "person",
  severity: "info",
  confidence: 0.9,
  timestamp: 1,
  acknowledged: false,
};

test("matching person event reaches only its connected alert", () =>
  assert.deepEqual(
    matchingActions(flow, event).map((n) => n.id),
    ["alert"],
  ));
test("branching bag event fans out to both actions once", () =>
  assert.deepEqual(
    matchingActions(flow, { ...event, type: "backpack" }).map((n) => n.id),
    ["alert", "voice"],
  ));
test("unmatched classes and other cameras do not execute", () => {
  assert.equal(matchingActions(flow, { ...event, type: "dog" }).length, 0);
  assert.equal(
    matchingActions(flow, { ...event, cameraId: "other" }).length,
    0,
  );
});
test("paused workflows and sample events never execute", () => {
  assert.equal(matchingActions({ ...flow, enabled: false }, event).length, 0);
  assert.equal(matchingActions(flow, { ...event, demo: true }).length, 0);
});
test("disconnected actions are not reached", () =>
  assert.equal(
    matchingActions(
      { ...flow, edges: flow.edges.filter((e) => e.target !== "alert") },
      event,
    ).length,
    0,
  ));
test("wildcard rules match an event class", () =>
  assert.deepEqual(
    matchingActions(
      {
        ...flow,
        nodes: flow.nodes.map((n) =>
          n.id === "person" ? { ...n, detectionClass: "*" } : n,
        ),
      },
      { ...event, type: "dog" },
    ).map((n) => n.id),
    ["alert"],
  ));
test("evaluation is independent of edge ordering", () =>
  assert.deepEqual(
    matchingActions({ ...flow, edges: [...flow.edges].reverse() }, event).map(
      (n) => n.id,
    ),
    ["alert"],
  ));
test("valid workflow parses, cycles and duplicate IDs are rejected", () => {
  assert.ok(workflowSchema.safeParse(flow).success);
  assert.equal(
    workflowSchema.safeParse({
      ...flow,
      edges: [
        ...flow.edges,
        { id: "cycle", source: "person", target: "person" },
      ],
    }).success,
    false,
  );
  assert.equal(
    workflowSchema.safeParse({ ...flow, nodes: [...flow.nodes, flow.nodes[0]] })
      .success,
    false,
  );
});
test("dangling edges and invalid graph direction are rejected", () => {
  assert.equal(
    workflowSchema.safeParse({
      ...flow,
      edges: [{ id: "bad", source: "missing", target: "alert" }],
    }).success,
    false,
  );
  assert.equal(
    workflowSchema.safeParse({
      ...flow,
      edges: [{ id: "bad", source: "alert", target: "in" }],
    }).success,
    false,
  );
});
test("delivery status distinguishes pending, partial, and failure", () => {
  const r = (status) => ({
    nodeId: "n",
    action: "browser",
    status,
    message: "",
  });
  assert.equal(executionStatus([r("pending")]), "pending");
  assert.equal(executionStatus([r("success")]), "success");
  assert.equal(executionStatus([r("failed")]), "failed");
  assert.equal(executionStatus([r("failed"), r("success")]), "partial");
});
test("face descriptors must be finite and within expected dimensions", () => {
  const person = {
    id: "p",
    name: "Person",
    role: "Team",
    embedding: Array(1024).fill(0.1),
    thumbnail: "",
    createdAt: 1,
  };
  assert.ok(faceSchema.safeParse(person).success);
  assert.equal(
    faceSchema.safeParse({ ...person, embedding: [NaN] }).success,
    false,
  );
});
test("PDF xref offsets point to real objects and pagination is bounded", () => {
  const pdf = new TextDecoder().decode(
    makePdf(
      "Odin (test) report",
      Array.from({ length: 120 }, (_, i) => `Event ${i} - content`),
    ),
  );
  assert.ok(pdf.startsWith("%PDF-1.4"));
  assert.match(pdf, /\/Count 3/);
  const xref = Number(pdf.match(/startxref\n(\d+)/)[1]);
  assert.equal(pdf.slice(xref, xref + 4), "xref");
  const entries = pdf
    .slice(xref)
    .split("\n")
    .filter((s) => /^\d{10} 00000 n/.test(s));
  entries.forEach((s, i) =>
    assert.ok(pdf.slice(Number(s.slice(0, 10))).startsWith(`${i + 1} 0 obj`)),
  );
});

test("Gemini defaults and existing legacy settings use the current model", async () => {
  const { DEFAULT_GEMINI_MODEL, resolveGeminiModel } =
    await import("../lib/gemini-model.ts");
  assert.equal(DEFAULT_GEMINI_MODEL, "gemini-3.8-flash");
  for (const value of [
    undefined,
    null,
    "",
    "gemini-2.5-flash",
    "invalid/model",
  ]) {
    assert.equal(resolveGeminiModel(value), DEFAULT_GEMINI_MODEL);
  }
  assert.equal(
    resolveGeminiModel("gemini-3.5-flash-lite"),
    "gemini-3.5-flash-lite",
  );
});

test("Gemini provider errors include the reason without exposing credentials", async () => {
  const { requestGemini } = await import("../lib/gemini-request.ts");
  const key = "private-test-credential";
  const logs = [];
  await assert.rejects(
    requestGemini({
      model: "test-model",
      key,
      parts: [],
      fetcher: async () =>
        Response.json(
          {
            error: {
              message: `Invalid request for key ${key}`,
              status: "INVALID_ARGUMENT",
            },
          },
          { status: 400 },
        ),
      log: (entry) => logs.push(entry),
    }),
    (error) =>
      error.status === 502 &&
      error.message.includes("HTTP 400") &&
      !error.message.includes(key),
  );
  assert.equal(JSON.stringify(logs).includes(key), false);
  assert.equal(logs[0].upstreamStatus, 400);
});

test("Gemini timeouts and connection failures get actionable errors", async () => {
  const { requestGemini } = await import("../lib/gemini-request.ts");
  for (const [name, status, message] of [
    ["TimeoutError", 504, "45 seconds"],
    ["TypeError", 502, "could not connect"],
  ]) {
    await assert.rejects(
      requestGemini({
        model: "test",
        key: "test",
        parts: [],
        fetcher: async () => {
          const e = new Error("network");
          e.name = name;
          throw e;
        },
        log: () => {},
      }),
      (error) => error.status === status && error.message.includes(message),
    );
  }
});

test("Gemini quota errors remain distinguishable from other failures", async () => {
  const { requestGemini } = await import("../lib/gemini-request.ts");
  await assert.rejects(
    requestGemini({
      model: "test",
      key: "test",
      parts: [],
      fetcher: async () =>
        Response.json(
          { error: { message: "Daily quota exceeded" } },
          { status: 429 },
        ),
      log: () => {},
    }),
    (error) =>
      error.status === 429 && error.message.includes("Daily quota exceeded"),
  );
});

test("Gemini JSON parsing excludes thoughts and reports incomplete responses", async () => {
  const { requestGemini } = await import("../lib/gemini-request.ts");
  const options = {
    model: "test",
    key: "test",
    parts: [],
    json: true,
    log: () => {},
  };
  const result = await requestGemini({
    ...options,
    fetcher: async () =>
      Response.json({
        candidates: [
          {
            content: {
              parts: [
                { thought: true, text: "internal thought" },
                { text: '{"summary":"ok"}' },
              ],
            },
          },
        ],
      }),
  });
  assert.deepEqual(result, { summary: "ok" });
  await assert.rejects(
    requestGemini({
      ...options,
      fetcher: async () =>
        Response.json({
          candidates: [{ content: { parts: [{ text: '{"summary":' }] } }],
        }),
    }),
    (error) => error.status === 502 && error.message.includes("invalid JSON"),
  );
});

test("semantic rules need a verified match and remain scoped to their workflow", () => {
  const semantic = {
    ...flow,
    nodes: flow.nodes.map((n) =>
      n.id === "person" ? { ...n, ruleMode: "semantic" } : n,
    ),
  };
  assert.deepEqual(matchingActions(semantic, event), []);
  assert.deepEqual(
    matchingActions(semantic, { ...event, matchedRuleIds: ["other:person"] }),
    [],
  );
  assert.deepEqual(
    matchingActions(semantic, { ...event, matchedRuleIds: ["f:person"] }).map(
      (n) => n.id,
    ),
    ["alert"],
  );
});
test("demo preview traces the graph without permitting action delivery", async () => {
  const { traceWorkflow } = await import("../lib/workflow-engine.ts");
  const demo = { ...event, demo: true };
  assert.equal(traceWorkflow(flow, demo).length, 0);
  assert.deepEqual(
    traceWorkflow({ ...flow, enabled: false }, demo, true).sort(),
    ["in", "person", "alert"].sort(),
  );
  assert.deepEqual(matchingActions(flow, demo), []);
});
test("geometric tracks persist within a camera and expire after absence", async () => {
  const { CameraTracker, overlap } = await import("../lib/tracking.ts");
  const tracker = new CameraTracker();
  const detection = { class: "person", bbox: [10, 10, 100, 100], score: 0.9 };
  const first = tracker.update([detection], "cam", 0)[0];
  assert.equal(
    tracker.update([{ ...detection, bbox: [15, 12, 100, 100] }], "cam", 1000)[0]
      .trackId,
    first.trackId,
  );
  const simultaneous = tracker.update([detection, detection], "cam", 2000);
  assert.notEqual(simultaneous[0].trackId, simultaneous[1].trackId);
  assert.notEqual(
    tracker.update([detection], "cam", 12000)[0].trackId,
    first.trackId,
  );
  assert.equal(overlap([0, 0, 10, 10], [20, 20, 10, 10]), 0);
});
test("cloud analysis prevents concurrent requests and backs off quota errors", async () => {
  const { queuedAnalysis } = await import("../lib/analysis-queue.ts");
  let finish;
  const first = queuedAnalysis(() => new Promise((r) => (finish = r)), 0);
  await assert.rejects(
    queuedAnalysis(async () => {}, 0),
    /Another camera analysis/,
  );
  finish("ok");
  assert.equal(await first, "ok");
  await assert.rejects(
    queuedAnalysis(async () => {
      throw Object.assign(new Error("quota"), { status: 429 });
    }, 0),
    /quota/,
  );
  await assert.rejects(
    queuedAnalysis(async () => {}, 0),
    /cooldown/,
  );
});

test("track IDs do not join identities across camera changes or capture sessions", async () => {
  const { CameraTracker } = await import("../lib/tracking.ts");
  const a = new CameraTracker(),
    b = new CameraTracker();
  const detection = { class: "person", bbox: [10, 10, 100, 100], score: 0.9 };
  const first = a.update([detection], "cameraA", 0)[0].trackId;
  assert.notEqual(a.update([detection], "cameraB", 100)[0].trackId, first);
  assert.notEqual(b.update([detection], "cameraA", 100)[0].trackId, first);
});
