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
