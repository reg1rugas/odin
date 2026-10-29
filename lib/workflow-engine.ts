import type { Event, Workflow, FlowNode, Execution } from "./types";

/** Evaluate one event through a directed workflow without performing side effects. */
export function matchingActions(flow: Workflow, event: Event): FlowNode[] {
  if (!flow.enabled || event.demo) return [];
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
      if (
        node &&
        (node.type !== "rule" ||
          node.detectionClass === "*" ||
          node.detectionClass === event.type)
      ) {
        reached.add(node.id);
        changed = true;
      }
    }
    if (!changed) break;
  }
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
