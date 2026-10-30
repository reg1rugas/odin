import type { Event, FlowNode, Workflow } from "./types";
export type Point = { x: number; y: number };
export type SpatialState = { signature: string; inside?: boolean; since?: number; fired?: boolean; point?: Point; at: number };
export function inPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    const cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x);
    if (Math.abs(cross) < 1e-8 && point.x >= Math.min(a.x, b.x) && point.x <= Math.max(a.x, b.x) && point.y >= Math.min(a.y, b.y) && point.y <= Math.max(a.y, b.y)) return true;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
const side = (a: Point, b: Point, p: Point) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
export function crossedLine(previous: Point, current: Point, a: Point, b: Point, direction = "either") {
  const from = side(a, b, previous), to = side(a, b, current);
  if (from * to >= 0 || side(previous, current, a) * side(previous, current, b) > 0) return false;
  return direction === "either" || (direction === "positive" ? to > 0 : to < 0);
}
export function evaluateSpatialRules(flows: Workflow[], event: Event, previous: Event | null) {
  const matches = new Set<string>();
  const states: Record<string, SpatialState> = {};
  if (!event.trackId || event.origin !== "local") return { matches: [], states };
  for (const flow of flows) {
    if (!flow.enabled || !flow.nodes.some(n => n.type === "input" && (!n.cameraId || n.cameraId === event.cameraId))) continue;
    for (const node of flow.nodes) {
      const detectionClass = node.detectionClass || "person";
      if (node.type !== "rule" || node.ruleMode !== "spatial" || !node.spatial || (detectionClass !== "*" && detectionClass !== event.type)) continue;
      const key = `${flow.id}:${node.id}`, rule = node.spatial;
      const signature = JSON.stringify([rule, node.detectionClass]);
      let state = previous?.spatialState?.[key];
      if (state?.signature !== signature) state = undefined;
      let points = [...(event.trail || []), ...(event.position ? [event.position] : [])].sort((a, b) => a.at - b.at);
      // Seed new rules from a recent known position, without replaying the old
      // trail. Otherwise the first crossing after enabling a rule is discarded.
      if (previous && !state) {
        const baseline = previous.position ?? previous.trail?.at(-1);
        const latest = points.at(-1);
        if (baseline && latest && latest.at >= baseline.at && latest.at - baseline.at <= 10000) {
          const inside = rule.kind !== "line_cross" && inPolygon(baseline, rule.points);
          state = {signature, at: baseline.at, point: baseline, inside, since: inside ? (rule.kind === "dwell" ? latest.at : baseline.at) : undefined};
        } else points = points.slice(-1);
      }
      for (const point of points) {
        if (state && point.at <= state.at) continue;
        if (state && point.at - state.at > 10000) state = undefined;
        const inside = rule.kind !== "line_cross" && inPolygon(point, rule.points);
        let matched = false;
        if (rule.kind === "line_cross") {
          if (state?.point && Math.abs(side(rule.points[0], rule.points[1], point)) < 1e-8) { state = {...state, at: point.at}; continue; }
          matched = !!state?.point && crossedLine(state.point, point, rule.points[0], rule.points[1], rule.direction);
        } else {
          if (rule.kind === "zone_enter") matched = inside && !state?.inside;
          if (rule.kind === "zone_exit") matched = !inside && state?.inside === true;
          const since = inside ? (state?.inside ? state.since ?? point.at : point.at) : undefined;
          if (rule.kind === "dwell") matched = inside && !state?.fired && point.at - (since ?? point.at) >= (rule.seconds || 30) * 1000;
          state = { signature, at: point.at, inside, since, fired: inside && (matched || !!state?.fired) };
        }
        if (matched) matches.add(key);
        state = { ...state, signature, at: point.at, point };
      }
      if (state) states[key] = state;
    }
  }
  return { matches: [...matches], states };
}
export type SpatialRule = NonNullable<FlowNode["spatial"]>;
