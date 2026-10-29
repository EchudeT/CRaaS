import type { Edge, Node } from '@xyflow/react'

export interface Point { x: number; y: number }
interface Rect extends Point { id: string; width: number; height: number }
type Side = 'l' | 'r' | 't' | 'b'
export interface EdgeRoute { points: Point[]; path: string; center: Point }
const CLEARANCE = 12
const EXIT = 28

function port(rect: Rect, side: Side): Point {
  return { x: side === 'l' ? rect.x : side === 'r' ? rect.x + rect.width : rect.x + rect.width / 2,
    y: side === 't' ? rect.y : side === 'b' ? rect.y + rect.height : rect.y + rect.height / 2 }
}

function exit(point: Point, side: Side): Point {
  return { x: point.x + (side === 'r' ? EXIT : side === 'l' ? -EXIT : 0),
    y: point.y + (side === 'b' ? EXIT : side === 't' ? -EXIT : 0) }
}

function blocked(a: Point, b: Point, rect: Rect, margin: number) {
  if (a.x === b.x) return a.x > rect.x - margin && a.x < rect.x + rect.width + margin &&
    Math.max(a.y, b.y) > rect.y - margin && Math.min(a.y, b.y) < rect.y + rect.height + margin
  return a.y > rect.y - margin && a.y < rect.y + rect.height + margin &&
    Math.max(a.x, b.x) > rect.x - margin && Math.min(a.x, b.x) < rect.x + rect.width + margin
}

function simplify(points: Point[]) {
  const result: Point[] = []
  points.forEach((point) => {
    const last = result[result.length - 1]
    if (last && point.x === last.x && point.y === last.y) return
    const before = result[result.length - 2]
    if (before && last && ((before.x === last.x && last.x === point.x) || (before.y === last.y && last.y === point.y))) {
      // Preserve a reversal: it is a routing error, not a redundant corner.
      if ((last.x - before.x) * (point.x - last.x) >= 0 && (last.y - before.y) * (point.y - last.y) >= 0) result.pop()
    }
    result.push(point)
  })
  return result
}

function pathFor(points: Point[]) {
  let path = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length - 1; i++) {
    const before = points[i - 1], current = points[i], after = points[i + 1]
    const incoming = Math.hypot(current.x - before.x, current.y - before.y)
    const outgoing = Math.hypot(after.x - current.x, after.y - current.y)
    const radius = Math.min(7, incoming / 2, outgoing / 2)
    const a = { x: current.x + (before.x - current.x) / incoming * radius, y: current.y + (before.y - current.y) / incoming * radius }
    const b = { x: current.x + (after.x - current.x) / outgoing * radius, y: current.y + (after.y - current.y) / outgoing * radius }
    path += ` L ${a.x} ${a.y} Q ${current.x} ${current.y} ${b.x} ${b.y}`
  }
  const end = points[points.length - 1]
  return path + ` L ${end.x} ${end.y}`
}

function congestion(points: Point[], used: [Point, Point][]) {
  let cost = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    for (const [c, d] of used) {
      if (a.x === b.x && c.x === d.x && Math.abs(a.x - c.x) < 8) {
        cost += Math.max(0, Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) - Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y))) * 2
      } else if (a.y === b.y && c.y === d.y && Math.abs(a.y - c.y) < 8) {
        cost += Math.max(0, Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x))) * 2
      }
    }
  }
  return cost
}

/** Route display edges through free channels, preserving all topology facts. */
export function routeEdges(nodes: Node[], edges: Edge[]): Edge[] {
  const rects = new Map<string, Rect>()
  const obstacles: Rect[] = []
  nodes.forEach((node) => {
    const rect = { id: node.id, ...node.position,
      width: Number(node.style?.width) || node.measured?.width || 168,
      height: Number(node.style?.height) || node.measured?.height || 54 }
    if (node.type === 'zonebox') obstacles.push({ ...rect, height: 32 })
    else { rects.set(node.id, rect); obstacles.push(rect) }
  })
  const xLanes = new Set<number>(), yLanes = new Set<number>()
  obstacles.forEach((rect) => {
    xLanes.add(rect.x - EXIT); xLanes.add(rect.x + rect.width + EXIT)
    yLanes.add(rect.y - EXIT); yLanes.add(rect.y + rect.height + EXIT)
  })
  const used: [Point, Point][] = []
  return edges.map((edge, edgeIndex) => {
    const source = rects.get(edge.source), target = rects.get(edge.target)
    if (!source || !target) return edge
    const dx = target.x + target.width / 2 - source.x - source.width / 2
    const dy = target.y + target.height / 2 - source.y - source.height / 2
    const preferred: [Side, Side] = Math.abs(dx) > Math.abs(dy) ? [dx > 0 ? 'r' : 'l', dx > 0 ? 'l' : 'r'] : [dy > 0 ? 'b' : 't', dy > 0 ? 't' : 'b']
    const pairs: [Side, Side][] = [preferred]
    for (const a of ['r', 'l', 'b', 't'] as Side[]) for (const b of ['l', 'r', 't', 'b'] as Side[]) {
      if (a !== preferred[0] || b !== preferred[1]) pairs.push([a, b])
    }
    let best: { points: Point[]; sides: [Side, Side]; score: number } | undefined
    const laneOffset = ((edgeIndex % 5) - 2) * 9
    for (const sides of pairs) {
      const a = port(source, sides[0]), b = port(target, sides[1])
      const start = exit(a, sides[0]), end = exit(b, sides[1])
      if (obstacles.some((r) => r.id !== source.id && blocked(a, start, r, 2)) ||
          obstacles.some((r) => r.id !== target.id && blocked(end, b, r, 2))) continue
      const candidates: Point[][] = [
        [start, { x: end.x, y: start.y }, end],
        [start, { x: start.x, y: end.y }, end],
      ]
      for (const x of [(start.x + end.x) / 2 + laneOffset, ...xLanes]) candidates.push([start, { x: x + laneOffset, y: start.y }, { x: x + laneOffset, y: end.y }, end])
      for (const y of [(start.y + end.y) / 2 + laneOffset, ...yLanes]) candidates.push([start, { x: start.x, y: y + laneOffset }, { x: end.x, y: y + laneOffset }, end])
      for (const candidate of candidates) {
        let obstructed = false
        for (let i = 1; i < candidate.length && !obstructed; i++) {
          if (obstacles.some((rect) => blocked(candidate[i - 1], candidate[i], rect, CLEARANCE))) obstructed = true
        }
        if (obstructed) continue
        const points = simplify([a, ...candidate, b])
        const length = points.slice(1).reduce((sum, point, i) => sum + Math.hypot(point.x - points[i].x, point.y - points[i].y), 0)
        const baseScore = length + (points.length - 2) * 16
        if (best && baseScore >= best.score) continue
        const score = baseScore + congestion(points, used)
        if (!best || score < best.score) best = { points, sides, score }
      }
      // Fast path for a clear, direct connection; other sides cannot improve it.
      if (best && best.points.length === 2) break
    }
    if (!best) return edge
    for (let i = 1; i < best.points.length; i++) used.push([best.points[i - 1], best.points[i]])
    const segment = best.points.slice(1).map((point, i) => ({ a: best!.points[i], b: point, length: Math.hypot(point.x - best!.points[i].x, point.y - best!.points[i].y) }))
      .sort((a, b) => b.length - a.length)[0]
    const route: EdgeRoute = { points: best.points, path: pathFor(best.points), center: { x: (segment.a.x + segment.b.x) / 2, y: (segment.a.y + segment.b.y) / 2 } }
    return { ...edge, sourceHandle: best.sides[0], targetHandle: best.sides[1], data: { ...edge.data, route } }
  })
}
