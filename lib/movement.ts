export function summarizeMovement(trail: {x: number; y: number; at: number}[]) {
  const recent = trail.slice(-6), first = recent[0], last = recent.at(-1);
  if (!first || !last || last.at <= first.at) return {direction: "stationary", framePercentPerSecond: 0};
  const dx = last.x - first.x, dy = last.y - first.y, distance = Math.hypot(dx,dy);
  const directions = ["right", "down-right", "down", "down-left", "left", "up-left", "up", "up-right"];
  const index = Math.round((Math.atan2(dy,dx) + Math.PI * 2) / (Math.PI / 4)) % 8;
  return {direction: distance < 0.01 ? "stationary" : directions[index], framePercentPerSecond: distance * 100 / ((last.at - first.at) / 1000)};
}
