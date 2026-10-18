import type { Vec2 } from '../math/isometric';
import type { CollisionGrid } from './CollisionGrid';

interface SearchNode {
  readonly point: Vec2;
  cost: number;
  readonly estimate: number;
  parent: SearchNode | null;
}

function heuristic(from: Vec2, to: Vec2): number {
  const dx = Math.abs(from.x - to.x);
  const dy = Math.abs(from.y - to.y);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

/** Eight-neighbour A*, followed by radius-aware line-of-sight smoothing. */
export function findPath(grid: CollisionGrid, from: Vec2, to: Vec2, radius: number): Vec2[] | null {
  if (!grid.canOccupy(from, radius) || !grid.canOccupy(to, radius)) return null;
  if (Math.hypot(to.x - from.x, to.y - from.y) < 0.00001) return [];
  if (grid.isSegmentClear(from, to, radius)) return [{ ...to }];
  const start = { x: Math.round(from.x), y: Math.round(from.y) };
  const goal = { x: Math.round(to.x), y: Math.round(to.y) };
  const root: SearchNode = { point: start, cost: 0, estimate: heuristic(start, goal), parent: null };
  const open: SearchNode[] = [root];
  const nodes = new Map<number, SearchNode>([[start.y * grid.width + start.x, root]]);
  const closed = new Set<number>();
  let reached: SearchNode | null = null;
  while (open.length > 0) {
    open.sort((a, b) => (a.cost + a.estimate) - (b.cost + b.estimate) || a.estimate - b.estimate);
    const current = open.shift();
    if (!current) break;
    if (current.point.x === goal.x && current.point.y === goal.y) {
      reached = current;
      break;
    }
    closed.add(current.point.y * grid.width + current.point.x);
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const next = { x: current.point.x + dx, y: current.point.y + dy };
        const key = next.y * grid.width + next.x;
        if (grid.isBlocked(next.x, next.y) || closed.has(key) || !grid.canOccupy(next, radius)) continue;
        if (dx !== 0 && dy !== 0
          && (grid.isBlocked(current.point.x + dx, current.point.y) || grid.isBlocked(current.point.x, current.point.y + dy))) continue;
        if (!grid.isSegmentClear(current.point, next, radius)) continue;
        const cost = current.cost + Math.hypot(dx, dy);
        const existing = nodes.get(key);
        if (existing) {
          if (cost < existing.cost) {
            existing.cost = cost;
            existing.parent = current;
          }
        } else {
          const node: SearchNode = { point: next, cost, estimate: heuristic(next, goal), parent: current };
          nodes.set(key, node);
          open.push(node);
        }
      }
    }
  }
  if (!reached) return null;
  const raw: Vec2[] = [{ ...to }];
  for (let node: SearchNode | null = reached; node; node = node.parent) raw.push(node.point);
  raw.reverse();
  const result: Vec2[] = [];
  let anchor = from;
  let index = 0;
  while (index < raw.length) {
    let farthest = index;
    for (let candidate = raw.length - 1; candidate >= index; candidate -= 1) {
      const point = raw[candidate];
      if (point && grid.isSegmentClear(anchor, point, radius)) {
        farthest = candidate;
        break;
      }
    }
    const waypoint = raw[farthest];
    if (!waypoint || !grid.isSegmentClear(anchor, waypoint, radius)) return null;
    if (Math.hypot(waypoint.x - anchor.x, waypoint.y - anchor.y) > 0.00001) result.push(waypoint);
    anchor = waypoint;
    index = farthest + 1;
  }
  return result;
}
