import type { Event, Workflow, FlowNode, Execution } from "./types";

export function ruleMatches(
  node: FlowNode,
  event: Event,
  workflowId?: string,
): boolean {
  if (node.ruleMode === "semantic")
    return !!event.matchedRuleIds?.some(
      (id) => id === node.id || id === `${workflowId}:${node.id}`,
    );
  return node.detectionClass === "*" || node.detectionClass === event.type;
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
export function executionStatus(
  results: Execution["results"],
): Execution["status"] {
  const failed = results.filter((r) => r.status === "failed").length;
  if (results.length && failed === results.length) return "failed";
  if (failed) return "partial";
  if (results.some((r) => r.status === "pending")) return "pending";
  return "success";
}
