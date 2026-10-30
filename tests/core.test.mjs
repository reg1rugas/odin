import test from "node:test";
import assert from "node:assert/strict";
import { matchingActions, executionStatus } from "../lib/workflow-engine.ts";
import { workflowSchema, faceSchema, settingsSchema } from "../lib/validation.ts";
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

test("Gemini defaults reject non-Gemini settings and preserve explicit model choices", async () => {
  const { DEFAULT_GEMINI_MODEL, resolveGeminiModel } =
    await import("../lib/gemini-model.ts");
  assert.equal(DEFAULT_GEMINI_MODEL, "gemini-3.8-flash");
  for (const value of [
    undefined,
    null,
    "",
    "gpt-5.4-mini",
    "gpt-4.1",
    "invalid/model",
  ]) {
    assert.equal(resolveGeminiModel(value), DEFAULT_GEMINI_MODEL);
  }
  assert.equal(
    resolveGeminiModel("gemini-3.5-flash-lite"),
    "gemini-3.5-flash-lite",
  );
  assert.equal(resolveGeminiModel("gemini-2.5-flash"), "gemini-2.5-flash");
  assert.equal(resolveGeminiModel(" gemini-3.6-flash "), "gemini-3.6-flash");
});

test("saved Gemini model choices survive workspace normalization", async () => {
  const { resolveGeminiModel } = await import("../lib/gemini-model.ts");
  const settings = {
    id: "workspace", workspaceName: "Test", notifications: true,
    voice: false, confidence: 0.65, retention: 30,
  };
  for (const model of ["gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-2.5-flash", " gemini-3.1-flash-lite "]) {
    const saved = settingsSchema.parse({ ...settings, model });
    const reloaded = JSON.parse(JSON.stringify(saved));
    assert.equal(resolveGeminiModel(reloaded.model), model.trim());
  }
  for (const model of ["gpt-5.4-mini", "models/gemini-3.6-flash", "", "gemini flash"]) {
    assert.equal(settingsSchema.safeParse({ ...settings, model }).success, false);
  }
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

test("tracked sightings update one record and preserve review and movement evidence", async () => {
  const { trackEventId, mergeTrackEvent } = await import("../lib/track-events.ts");
  const id = await trackEventId("cam1", "person", "track1");
  assert.equal(await trackEventId("cam1", "person", "track1"), id);
  assert.notEqual(await trackEventId("cam2", "person", "track1"), id);
  assert.notEqual(await trackEventId("cam1", "person", "track2"), id);
  assert.notEqual(await trackEventId("cam1", "car", "track1"), id);
  const p = { x: 0.2, y: 0.3, at: 100 };
  const first = mergeTrackEvent(null, {...event, id, trackId: "track1", timestamp: 100, firstSeen: 90, observationCount: 1, trail: [p]});
  const next = mergeTrackEvent({...first, acknowledged: true}, {...first, timestamp: 200, observationCount: 6, acknowledged: false, position: {x: 0.6, y: 0.3, at: 200}, trail: [p, {x: 0.6, y: 0.3, at: 200}]});
  assert.equal(next.id, first.id);
  assert.equal(next.firstSeen, 90);
  assert.equal(next.lastSeen, 200);
  assert.equal(next.timestamp, 200);
  assert.equal(next.observationCount, 6);
  assert.equal(next.acknowledged, true);
  assert.equal(next.trail.length, 2);
  assert.equal(next.position.x, 0.6);
  assert.deepEqual(matchingActions(flow, next).map(n => n.id), matchingActions(flow, first).map(n => n.id));
});

test("movement samples are normalized, bounded and retained across track heartbeats", async () => {
  const { CameraTracker, trackMetadata } = await import("../lib/tracking.ts");
  const { mergeTrackEvent } = await import("../lib/track-events.ts");
  const tracker = new CameraTracker();
  let detected;
  for (let i = 0; i < 150; i++) detected = tracker.update([{class: "person", bbox: [10 + i / 10, 10, 100, 100], score: 0.9}], "cam1", 1000 + i * 100)[0];
  const metadata = trackMetadata(detected, 200, 100);
  assert.equal(metadata.observationCount, 150);
  assert.equal(metadata.firstSeen, 1000);
  assert.equal(metadata.trail.length, 120);
  assert.equal(metadata.position.y, 0.6);
  assert.ok(metadata.position.x > 0 && metadata.position.x < 1);
  const updated = mergeTrackEvent({...event, trail: [{x: 0, y: 0, at: 0}]}, {...event, ...metadata, timestamp: 20000});
  assert.equal(updated.trail.length, 120);
  const { eventInput } = await import("../lib/validation.ts");
  assert.equal(eventInput.safeParse({...event, ...metadata}).success, true);
  assert.equal(eventInput.safeParse({...event, position: {x: 2, y: 0, at: 1}}).success, false);
});

test("detail-mode merging preserves separate objects and removes overlapping duplicates", async () => {
  const {OBJECT_CLASSES, suppressDuplicates} = await import("../lib/detection-options.ts");
  assert.equal(new Set(OBJECT_CLASSES).size, 80);
  const boxes = suppressDuplicates([
    {class: "person", bbox: [0,0,100,100], score: 0.9},
    {class: "person", bbox: [2,2,100,100], score: 0.8},
    {class: "person", bbox: [300,0,100,100], score: 0.7},
    {class: "backpack", bbox: [0,0,100,100], score: 0.6},
    {class: "person", bbox: [0,0,-1,10], score: 1},
  ]);
  assert.equal(boxes.length, 3);
  assert.equal(boxes[0].score, 0.9);
  assert.equal(boxes.filter(b => b.class === "person").length, 2);
});

test("spatial rules detect entry, exit, dwell, and finite directional line crossings", async () => {
  const {evaluateSpatialRules, crossedLine, inPolygon} = await import("../lib/spatial-rules.ts");
  const points = [{x:0.2,y:0.2},{x:0.8,y:0.2},{x:0.8,y:0.8},{x:0.2,y:0.8}];
  const makeFlow = kind => ({...flow,nodes: flow.nodes.map(n => n.id === "person" ? {...n,ruleMode:"spatial",spatial:{kind,points,seconds:3}} : n)});
  const base = {...event,origin:"local",trackId:"track",trail:[{x:0.1,y:0.5,at:1000},{x:0.5,y:0.5,at:2000}]};
  const entry = evaluateSpatialRules([makeFlow("zone_enter")],base,null);
  assert.deepEqual(entry.matches,["f:person"]);
  const past = {...base,spatialState:entry.states};
  const repeated = evaluateSpatialRules([makeFlow("zone_enter")],{...base,trail:[{x:0.6,y:0.5,at:3000}]},past);
  assert.deepEqual(repeated.matches,[]);
  const exitFlow = makeFlow("zone_exit");
  const beforeExit = evaluateSpatialRules([exitFlow],base,null);
  const exit = evaluateSpatialRules([exitFlow],{...base,trail:[{x:0.9,y:0.5,at:4000}]},{...base,spatialState:beforeExit.states});
  assert.deepEqual(exit.matches,["f:person"]);
  const dwellFlow = makeFlow("dwell");
  const waiting = evaluateSpatialRules([dwellFlow],base,null);
  const dwell = evaluateSpatialRules([dwellFlow],{...base,trail:[{x:0.5,y:0.5,at:5000}]},{...base,spatialState:waiting.states});
  assert.deepEqual(dwell.matches,["f:person"]);
  assert.deepEqual(evaluateSpatialRules([dwellFlow],{...base,trail:[{x:0.5,y:0.5,at:6000}]},{...base,spatialState:dwell.states}).matches,[]);
  assert.deepEqual(evaluateSpatialRules([dwellFlow],{...base,trail:[{x:0.5,y:0.5,at:30000}]},{...base,spatialState:waiting.states}).matches,[]);
  assert.equal(inPolygon({x:0.2,y:0.5},points),true);
  const a={x:0.5,y:0.2},b={x:0.5,y:0.8};
  assert.equal(crossedLine({x:0.4,y:0.5},{x:0.6,y:0.5},a,b,"negative"),true);
  assert.equal(crossedLine({x:0.4,y:0.5},{x:0.6,y:0.5},a,b,"positive"),false);
  assert.equal(crossedLine({x:0.4,y:0.9},{x:0.6,y:0.9},a,b),false);
  const lineFlow = makeFlow("line_cross"); lineFlow.nodes.find(n=>n.id==="person").spatial.points=[a,b];
  const onLine=evaluateSpatialRules([lineFlow],{...base,trail:[{x:0.4,y:0.5,at:1000},{x:0.5,y:0.5,at:2000}]},null);
  assert.deepEqual(evaluateSpatialRules([lineFlow],{...base,trail:[{x:0.6,y:0.5,at:3000}]},{...base,spatialState:onLine.states}).matches,["f:person"]);
  assert.deepEqual(evaluateSpatialRules([{...dwellFlow,enabled:false}],base,null).matches,[]);
  assert.deepEqual(evaluateSpatialRules([dwellFlow],{...base,origin:"ai"},null).matches,[]);
  assert.deepEqual(matchingActions(makeFlow("zone_enter"),{...base,matchedLocalRuleIds:entry.matches}).map(n=>n.id),["alert"]);
  assert.deepEqual(matchingActions(makeFlow("zone_enter"),{...base,matchedLocalRuleIds:["other:person"]}),[]);
});

test("Gemini retries service errors with bounded backoff and reports token usage", async () => {
  const {requestGemini}=await import("../lib/gemini-request.ts");
  let calls=0;const waits=[],usage=[];
  const result=await requestGemini({model:"gemini-test",key:"private",parts:[],maxRetries:2,sleep:async ms=>{waits.push(ms);},log:()=>{},onUsage:async u=>{usage.push(u);},fetcher:async()=>{
    if(++calls<3)return Response.json({error:{message:"busy"}},{status:503});
    return Response.json({candidates:[{content:{parts:[{text:"ok"}]},finishReason:"STOP"}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:20,thoughtsTokenCount:5,totalTokenCount:125}});
  }});
  assert.equal(result,"ok");assert.equal(calls,3);assert.equal(waits.length,2);
  assert.deepEqual(usage,[{inputTokens:100,outputTokens:20,thinkingTokens:5,totalTokens:125}]);
  calls=0;
  await assert.rejects(requestGemini({model:"test",key:"private",parts:[],maxRetries:2,sleep:async()=>{},log:()=>{},fetcher:async()=>{calls++;return Response.json({error:{message:"quota"}},{status:429});}}));
  assert.equal(calls,1);
  calls=0;
  await assert.rejects(requestGemini({model:"test",key:"private",parts:[],maxRetries:2,sleep:async()=>{},log:()=>{},fetcher:async()=>{calls++;return Response.json({error:{message:"busy"}},{status:503});}}));
  assert.equal(calls,3);
});

test("incident buffer retains playable pre/post segments, resets across seeks, and stops capture", async t => {
  const {IncidentBuffer} = await import("../lib/incident-buffer.ts");
  let now=100000, tick, stopped=0;
  t.mock.method(Date,"now",()=>now);
  const originalDocument=globalThis.document, originalRecorder=globalThis.MediaRecorder;
  const context={drawImage(){},getImageData(){return {data:new Uint8ClampedArray(64*36*4)};}};
  const stream={getTracks:()=>[{stop(){stopped++;}}]};
  globalThis.document={createElement:()=>({width:640,height:360,getContext:()=>context,captureStream:()=>stream})};
  const recorders=[];
  globalThis.MediaRecorder=class {
    static isTypeSupported(){return true;}
    state="inactive";
    constructor(){recorders.push(this);}
    start(){this.state="recording";}
    stop(){this.state="inactive";this.ondataavailable?.({data:new Blob([new Uint8Array([0x1a,0x45,0xdf,0xa3,0,0,0,0,0,0,0,0,0,0,0,0])])});this.onstop?.();}
  };
  t.mock.method(globalThis,"setInterval",callback=>{tick=callback;return 1;});
  t.mock.method(globalThis,"clearInterval",()=>{});
  t.mock.method(globalThis,"setTimeout",()=>1);
  t.mock.method(globalThis,"clearTimeout",()=>{});
  let source=0;
  const video={paused:false,readyState:3,videoWidth:640,videoHeight:360};
  const evidence=[],statuses=[];
  const buffer=new IncidentBuffer(video,()=>source,async e=>{evidence.push(e);},s=>statuses.push(s));
  try {
    buffer.start();tick();
    const segment=()=>{now+=5000;source+=5;recorders.at(-1).stop();};
    segment();segment(); // Ten seconds of pre-trigger evidence.
    buffer.note([{class:"person",score:0.9,bbox:[100,100,50,100],trackId:"one"}],640,360);
    segment();segment();
    await Promise.resolve();await Promise.resolve();
    assert.equal(evidence.length,1);
    assert.deepEqual(evidence[0].segments.map(s=>s.at),[0,5,10,15]);
    assert.equal(evidence[0].segments.reduce((n,s)=>n+s.duration,0),20);
    assert.equal(evidence[0].observations[0].trackId,"one");
    for(const clip of evidence[0].segments) assert.deepEqual([...new Uint8Array(await clip.blob.arrayBuffer()).slice(0,4)],[0x1a,0x45,0xdf,0xa3]);
    buffer.trigger("Duplicate during cooldown");segment();segment();
    assert.equal(evidence.length,1);
    now+=65000;source+=65;
    recorders.at(-1).stop(); // Long capture gap resets rather than joining unrelated video.
    assert.ok(statuses.some(s=>s.includes("reset")));
    const before=recorders.length;
    buffer.stop();
    assert.equal(stopped,1);
    assert.equal(recorders.length,before);
  } finally {globalThis.document=originalDocument;globalThis.MediaRecorder=originalRecorder;}
});

test("spatial workflow validation rejects empty, degenerate or out-of-frame regions", () => {
  const spatial={...flow,nodes:flow.nodes.map(n=>n.id==="person"?{...n,ruleMode:"spatial",spatial:{kind:"zone_enter",points:[{x:0,y:0},{x:1,y:0},{x:1,y:1}]}}:n)};
  assert.equal(workflowSchema.safeParse(spatial).success,true);
  for(const points of [[],[{x:0,y:0},{x:1,y:1}],[{x:0,y:0},{x:0.5,y:0.5},{x:1,y:1}],[{x:-1,y:0},{x:1,y:0},{x:1,y:1}]]) {
    assert.equal(workflowSchema.safeParse({...spatial,nodes:spatial.nodes.map(n=>n.id==="person"?{...n,spatial:{...n.spatial,points}}:n)}).success,false);
  }
});

test("incident API enforces budgets, isolates owners, saves evidence, and deduplicates retries", async () => {
  const {DatabaseSync}=await import("node:sqlite");
  const {readFile}=await import("node:fs/promises");
  const {runInNewContext}=await import("node:vm");
  const ts=await import("typescript");
  const {z}=await import("zod");
  const db=new DatabaseSync(":memory:");
  db.exec("CREATE TABLE records (id TEXT,owner TEXT,kind TEXT,data TEXT,created_at INTEGER,updated_at INTEGER,UNIQUE(owner,kind,id))");
  const storage=new Map();let analyses=0,currentOwner="owner";
  const env = {
    BUCKET: {put: async (key, bytes) => storage.set(key, bytes), delete: async key => storage.delete(key)},
    DB: {
      prepare(sql) {
        return {bind(...args) {
          return {
            first: async () => db.prepare(sql).get(...args) || null,
            run: async () => ({meta: {changes: Number(db.prepare(sql).run(...args).changes)}}),
          };
        }};
      },
    },
  };
  const readOne=async(owner,kind,id)=>{const r=db.prepare("SELECT data FROM records WHERE owner=? AND kind=? AND id=?").get(owner,kind,id);return r?JSON.parse(r.data):null;};
  const save=async(owner,kind,value)=>{db.prepare("INSERT INTO records VALUES (?,?,?,?,?,?) ON CONFLICT(owner,kind,id) DO UPDATE SET data=excluded.data").run(value.id,owner,kind,JSON.stringify(value),Date.now(),Date.now());return value;};
  class ApiError extends Error {constructor(message,status=400){super(message);this.status=status;}}
  const module={exports:{}};
  const code=ts.transpileModule(await readFile(new URL("../app/api/incidents/route.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  runInNewContext(code,{module,exports:module.exports,require:name=>{
    if(name==="cloudflare:workers")return {env};
    if(name==="zod")return {z};
    if(name==="@/lib/server")return {identity:async()=>({userId:currentOwner}),ApiError,readOne,save,secret:()=>"test-key",fail:error=>Response.json({error:error.message},{status:error.status||500})};
    if(name==="@/lib/scene-analysis")return {analyzeScene:async()=>{analyses++;return {summary:"Supported rule",model:"gemini-test",events:[{matchedRuleIds:["f:person"]}],executions:[]};}};
    throw new Error(name);
  },URL,Request,Response,File,FormData,Blob,Uint8Array,TextEncoder,btoa,crypto,console});
  await save("owner","cameras",{id:"camera",source:"webcam",name:"Camera"});
  await save("owner","settings",{id:"workspace",aiChecksPerHour:1});
  const request=(id,origin)=>{
    const form=new FormData();
    form.set("metadata",JSON.stringify({id,cameraId:"camera",sessionId:"session",reason:"Person entered",segments:[{at:0,startedAt:Date.now(),duration:5}],observations:[{type:"person",trackId:"t"}]}));
    form.append("clips",new Blob([new Uint8Array([0x1a,0x45,0xdf,0xa3,...Array(20).fill(0)])],{type:"video/webm"}),"clip.webm");
    return new Request("https://odin.test/api/incidents",{method:"POST",body:form,...(origin?{headers:{origin}}:{})});
  };
  try {
    const id=crypto.randomUUID();
    const first=await module.exports.POST(request(id));
    assert.equal(first.status,200);assert.equal((await first.json()).incident.status,"verified");
    assert.equal(analyses,1);assert.equal(storage.size,1);
    await module.exports.POST(request(id));
    assert.equal(analyses,1);assert.equal(storage.size,1);
    const second=await module.exports.POST(request(crypto.randomUUID()));
    assert.equal((await second.json()).incident.status,"skipped");assert.equal(analyses,1);
    assert.equal((await module.exports.POST(request(crypto.randomUUID(),"https://other.test"))).status,403);
    currentOwner="other-owner";
    assert.equal((await module.exports.POST(request(crypto.randomUUID()))).status,400);
    currentOwner="owner";
    await save("owner","settings",{id:"workspace",aiChecksPerHour:5});
    const duplicate=crypto.randomUUID();
    await Promise.all([module.exports.POST(request(duplicate)),module.exports.POST(request(duplicate))]);
    assert.equal(analyses,2); // Only one of the two concurrent uploads can reserve this ID.
  } finally {db.close();}
});

test("movement summaries measure image displacement and reset tracks explicitly", async () => {
  const {summarizeMovement}=await import("../lib/movement.ts");
  assert.deepEqual(summarizeMovement([{x:0.1,y:0.2,at:1000},{x:0.3,y:0.2,at:3000}]),{direction:"right",framePercentPerSecond:10});
  assert.equal(summarizeMovement([{x:0.1,y:0.2,at:1000},{x:0.1,y:0.4,at:3000}]).direction,"down");
  assert.equal(summarizeMovement([{x:0.1,y:0.2,at:1000}]).framePercentPerSecond,0);
  const {CameraTracker}=await import("../lib/tracking.ts");const tracker=new CameraTracker();
  const box={class:"person",bbox:[0,0,100,100],score:0.9};
  const before=tracker.update([box],"camera",1000)[0].trackId;
  tracker.reset();assert.notEqual(tracker.update([box],"camera",1001)[0].trackId,before);
});

test("truncated Gemini JSON cannot verify scene rules even when it parses", async () => {
  const {requestGemini}=await import("../lib/gemini-request.ts");
  await assert.rejects(requestGemini({model:"test",key:"test",parts:[],json:true,log:()=>{},fetcher:async()=>Response.json({candidates:[{finishReason:"MAX_TOKENS",content:{parts:[{text:'{"events":[{"matchedRuleIds":["f:person"]}]}'}]}}]})}),/output limit/);
});

test("non-overlapping person movement produces line and initially-inside zone exit alerts end to end", async t => {
  const {DatabaseSync}=await import("node:sqlite");
  const {readFile}=await import("node:fs/promises");
  const {runInNewContext}=await import("node:vm");
  const ts=await import("typescript");
  const engine=await import("../lib/workflow-engine.ts");
  const tracking=await import("../lib/tracking.ts");
  const spatial=await import("../lib/spatial-rules.ts");
  const trackEvents=await import("../lib/track-events.ts");
  const validation=await import("../lib/validation.ts");
  let now=100000;t.mock.method(Date,"now",()=>now);
  const db=new DatabaseSync(":memory:");
  db.exec("CREATE TABLE records (id TEXT,owner TEXT,kind TEXT,data TEXT,created_at INTEGER,updated_at INTEGER,UNIQUE(owner,kind,id))");
  const env={DB:{prepare(sql){return {bind(...args){return {
    first:async()=>db.prepare(sql).get(...args)||null,
    all:async()=>({results:db.prepare(sql).all(...args)}),
    run:async()=>({meta:{changes:Number(db.prepare(sql).run(...args).changes)}}),
  };}};}}};
  const load=async(path,dependencies)=>{
    const module={exports:{}};
    const code=ts.transpileModule(await readFile(new URL(path,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    runInNewContext(code,{module,exports:module.exports,require:name=>{
      if(name in dependencies)return dependencies[name];throw new Error(`Unmocked dependency: ${name}`);
    },Date,JSON,URL,Request,Response,TextEncoder,Uint8Array,crypto,console,Map,Set});
    return module.exports;
  };
  const server=await load("../lib/server.ts",{
    "cloudflare:workers":{env},"@/app/chatgpt-auth":{},"./seed":{},"./gemini-request":{},"./gemini-model":{},"./workflow-engine":engine,
  });
  const api=await load("../app/api/events/route.ts",{
    "@/lib/server":{...server,identity:async()=>({userId:"owner"})},"@/lib/validation":validation,"@/lib/spatial-rules":spatial,"@/lib/track-events":trackEvents,
  });
  const {submitTracks}=await load("../lib/submit-tracks.ts",{"./inference":{captureFrame:()=>"test snapshot"},"./tracking":tracking});
  const make=(id,kind,points)=>({id,name:id,description:"",enabled:true,createdAt:now,nodes:[
    {id:"in",type:"input",cameraId:"cam1",title:"Camera",description:"",x:0,y:0},
    {id:"rule",type:"rule",ruleMode:"spatial",detectionClass:"person",spatial:{kind,points},title:kind,description:"",x:1,y:0},
    {id:"notify",type:"action",action:"browser",cooldown:30,title:"Alert",description:"",x:2,y:0},
  ],edges:[{id:"a",source:"in",target:"rule"},{id:"b",source:"rule",target:"notify"}]});
  try {
    await server.save("owner","cameras",{id:"cam1",source:"webcam",name:"Camera"});
    await server.save("owner","workflows",make("line","line_cross",[{x:0.5,y:0},{x:0.5,y:1}]));
    await server.save("owner","workflows",make("zone","zone_exit",[{x:0.3,y:0.2},{x:0.6,y:0.2},{x:0.6,y:0.8},{x:0.3,y:0.8}]));
    const tracker=new tracking.CameraTracker(),last=new Map();let trackId;
    const submit=async center=>{
      const detections=tracker.update([{class:"person",bbox:[center*1000-30,100,60,100],score:0.9}],"cam1",now,{width:1000,height:500});
      trackId ||= detections[0].trackId;
      assert.equal(detections[0].trackId,trackId,"Fast movement must keep the track across non-overlapping boxes");
      const result=await submitTracks({detections,video:{videoWidth:1000,videoHeight:500},cameraId:"cam1",sourceTime:(now-100000)/1000,last,spatialRulesActive:true,api:async(_path,body)=>{
        const response=await api.POST(new Request("https://odin.test/api/events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}));
        assert.equal(response.status,200);return response.json();
      }});
      now+=1000;return result;
    };
    assert.equal((await submit(0.45)).executions.length,0);
    const crossing=await submit(0.55);
    assert.equal(crossing.executions[0].results[0].status,"pending");
    assert.match(crossing.executions[0].eventTitle,/Line crossed/);
    const exit=await submit(0.65);
    assert.equal(exit.executions[0].results[0].status,"pending");
    assert.match(exit.executions[0].eventTitle,/Zone exited/);
    await submit(0.55);
    const repeat=await submit(0.45);
    assert.equal(repeat.executions[0].status,"skipped");
    assert.match(repeat.executions[0].results[0].message,/cooldown/);
    assert.equal(db.prepare("SELECT count(*) AS n FROM records WHERE kind='events'").get().n,1);
    const alerts=await server.readCameraAlerts("owner",["cam1"]);
    const lineAlert=alerts.find(a=>a.eventTitle.includes("Line crossed") && a.status==="pending");
    assert.equal(lineAlert.cameraId,"cam1");
    assert.equal(lineAlert.trackId,trackId);
    assert.equal(lineAlert.sourceTime,1,"Alert must retain trigger video time after the tracked event advances");
    assert.equal(lineAlert.origin,"local");
    assert.equal((await server.readCameraAlerts("other-owner",["cam1"])).length,0);
    assert.equal((await server.readCameraAlerts("owner",["different-camera"])).length,0);
    await server.save("owner","executions",{...lineAlert,id:"legacy",cameraId:undefined});
    assert.equal((await server.readCameraAlerts("owner",["cam1"])).find(a=>a.id==="legacy").cameraId,"cam1","Legacy alerts are scoped through their event");
    let prompt="";
    const chat=await load("../app/api/chat/route.ts",{"@/lib/server":{...server,identity:async()=>({userId:"owner"}),secret:()=>"configured",gemini:async(_owner,text)=>{prompt=text;return "Recorded alert, delivery pending.";}}});
    const answer=await chat.POST(new Request("https://odin.test/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cameraIds:["cam1"],message:"Were there alerts?"})}));
    assert.equal(answer.status,200);
    assert.match(prompt,/Workflow alerts:/);
    assert.match(prompt,/Line crossed/);
    assert.match(prompt,/delivery is unconfirmed/);
  } finally {db.close();}
});

test("browser workflow delivery shows an in-app alert or an explicit disabled-notification error", async () => {
  const {readFile}=await import("node:fs/promises");const {runInNewContext}=await import("node:vm");const ts=await import("typescript");
  const source=await readFile(new URL("../components/odin-context.tsx",import.meta.url),"utf8");
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  for(const notifications of [true,false]) {
    let stateIndex=0;const toasts=[],patches=[];
    const hooks={createContext:()=>({}),useContext:()=>null,useCallback:fn=>fn,useEffect:()=>{},useRef:value=>({current:value}),useState:initial=>{
      const value=stateIndex++===0?{settings:{notifications,voice:false}}:initial;
      return [value,next=>{if(next&&typeof next==="object"&&"text" in next)toasts.push(next);}];
    }};
    const module={exports:{}};
    runInNewContext(code,{module,exports:module.exports,require:name=>{if(name==="react")return hooks;throw new Error(name);},window:{},setTimeout:()=>1,clearTimeout:()=>{},Response,fetch:async(_url,options)=>{patches.push(JSON.parse(options.body));return Response.json({});}});
    const {context}=module.exports.useOdinState();
    await context.deliver([{id:"run",workflowName:"Door",eventTitle:"Line crossed · person",results:[{nodeId:"alert",action:"browser",status:"pending",message:""}]}]);
    assert.equal(patches[0].status,notifications?"success":"failed");
    assert.ok(toasts.some(t=>notifications?t.text==="Line crossed · person":t.text.includes("disabled in Settings")));
  }
});

test("newly enabled spatial rules retain a recent already-inside baseline without replaying old trails", async () => {
  const {evaluateSpatialRules}=await import("../lib/spatial-rules.ts");
  const make=(kind,points)=>({...flow,nodes:flow.nodes.map(n=>n.id==="person"?{...n,ruleMode:"spatial",spatial:{kind,points}}:n)});
  const previous={...event,origin:"local",trackId:"track",position:{x:0.45,y:0.5,at:1000},trail:[{x:0.1,y:0.5,at:0},{x:0.45,y:0.5,at:1000}]};
  const current={...previous,position:{x:0.7,y:0.5,at:2000},trail:[{x:0.7,y:0.5,at:2000}]};
  const zone=[{x:0.2,y:0.2},{x:0.6,y:0.2},{x:0.6,y:0.8},{x:0.2,y:0.8}];
  assert.deepEqual(evaluateSpatialRules([make("zone_exit",zone)],current,previous).matches,["f:person"]);
  assert.deepEqual(evaluateSpatialRules([make("line_cross",[{x:0.5,y:0},{x:0.5,y:1}])],current,previous).matches,["f:person"]);
  const outside={...previous,position:{x:0.7,y:0.5,at:1000}};
  assert.deepEqual(evaluateSpatialRules([make("zone_exit",zone)],current,outside).matches,[]);
});
