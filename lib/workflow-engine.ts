import type { Event, Workflow, FlowNode, Execution } from "./types";

export function ruleMatches(
  node: FlowNode,
  event: Event,
  workflowId?: string,
): boolean {
  if (node.ruleMode === "spatial")
    return event.origin === "local" && !!event.matchedLocalRuleIds?.includes(`${workflowId}:${node.id}`);
  if (node.ruleMode === "semantic")
    return !!event.matchedRuleIds?.some(
      (id) => id === node.id || id === `${workflowId}:${node.id}`,
    );
  return node.detectionClass === "*" || (node.detectionClass || "person") === event.type;
}
/** The preview flag evaluates demo annotations without performing any actions. */
export function traceWorkflow(
  flow: Workflow,
  event: Event,
  preview = false,
): string[] {
  if ((!flow.enabled || event.demo) && !preview) return [];
  const reached = new Set(
    flow.nodes
      .filter(
        (n) =>
          n.type === "input" && (!n.cameraId || n.cameraId === event.cameraId),
      )
      .map((n) => n.id),
  );
  for (let i = 0; i < flow.nodes.length; i++) {
    let changed = false;
    for (const edge of flow.edges) {
      if (!reached.has(edge.source) || reached.has(edge.target)) continue;
      const node = flow.nodes.find((n) => n.id === edge.target);
      if (node && (node.type !== "rule" || ruleMatches(node, event, flow.id))) {
        reached.add(node.id);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return [...reached];
}
export function matchingActions(flow: Workflow, event: Event): FlowNode[] {
  const reached = new Set(traceWorkflow(flow, event));
  return flow.nodes.filter((n) => n.type === "action" && reached.has(n.id));
}
export function workflowTriggerTitle(flow: Workflow, event: Event): string {
  const labels = {zone_enter: "Zone entered", zone_exit: "Zone exited", line_cross: "Line crossed", dwell: "Dwell time reached"};
  const spatial = flow.nodes.filter(n => n.ruleMode === "spatial" && n.spatial && event.matchedLocalRuleIds?.includes(`${flow.id}:${n.id}`));
  return spatial.length ? spatial.map(n => `${labels[n.spatial!.kind]} · ${event.type} · ${n.title}`).join("; ") : event.title;
}
export function executionStatus(
  results: Execution["results"],
): Execution["status"] {
  if (results.length && results.every(r => r.status === "skipped")) return "skipped";
  const failed = results.filter((r) => r.status === "failed").length;
  if (results.length && failed === results.length) return "failed";
  if (failed) return "partial";
  if (results.some((r) => r.status === "pending")) return "pending";
  return "success";
}
