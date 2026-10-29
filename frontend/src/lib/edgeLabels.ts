import type { Edge, Node } from '@xyflow/react'
import type { EdgeRoute } from './edgeRouting'

export interface LabelPlacement { x: number; y: number; width: number; height: number }
interface Rect { x: number; y: number; width: number; height: number }

function overlap(a: Rect, b: Rect) {
  return Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
}

function anchor(rect: Rect, handle?: string | null) {
  if (handle === 'l') return { x: rect.x, y: rect.y + rect.height / 2 }
  if (handle === 'r') return { x: rect.x + rect.width, y: rect.y + rect.height / 2 }
  if (handle === 't') return { x: rect.x + rect.width / 2, y: rect.y }
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height }
}

/** Positions are presentation-only. Neither the extracted links nor nodes are changed. */
export function placeEdgeLabels(nodes: Node[], edges: Edge[]): Map<string, LabelPlacement> {
  const rects = new Map<string, Rect>()
  const obstacles: Rect[] = []
  nodes.forEach((node) => {
    const width = Number(node.style?.width) || node.measured?.width || 168
    const height = Number(node.style?.height) || node.measured?.height || 54
    const rect = { ...node.position, width, height }
    if (node.type === 'zonebox') obstacles.push({ ...rect, height: 32 })
    else { rects.set(node.id, rect); obstacles.push(rect) }
  })
  const placed: Rect[] = []
  const result = new Map<string, LabelPlacement>()
  edges.forEach((edge) => {
    if (typeof edge.label !== 'string' || !edge.label) return
    const source = rects.get(edge.source), target = rects.get(edge.target)
    if (!source || !target) return
    const a = anchor(source, edge.sourceHandle), b = anchor(target, edge.targetHandle)
    const route = edge.data?.route as EdgeRoute | undefined
    const points = route?.points ?? [a, b]
    const segments = points.slice(1).map((point, i) => ({ a: points[i], b: point, length: Math.hypot(point.x - points[i].x, point.y - points[i].y) }))
      .filter((segment) => segment.length > 0).sort((a, b) => b.length - a.length)
    const textWidth = Array.from(edge.label).reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? 10 : 6.1), 0)
    const width = Math.min(184, Math.max(44, textWidth + 16))
    const height = Math.ceil(textWidth / (width - 16)) * 14 + 10
    let best: LabelPlacement = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, width, height }
    let bestScore = Infinity
    for (const segment of segments) for (const fraction of [0.5, 0.35, 0.65]) {
      const normal = { x: -(segment.b.y - segment.a.y) / segment.length, y: (segment.b.x - segment.a.x) / segment.length }
      for (const distance of [0, 24, -24, 48, -48, 80, -80, 120, -120, 180, -180, 240, -240]) {
        const x = segment.a.x + (segment.b.x - segment.a.x) * fraction + normal.x * distance
        const y = segment.a.y + (segment.b.y - segment.a.y) * fraction + normal.y * distance
        const rect = { x: x - width / 2 - 5, y: y - height / 2 - 5, width: width + 10, height: height + 10 }
        const score = obstacles.reduce((sum, obstacle) => sum + overlap(rect, obstacle) * 1000, 0) +
          placed.reduce((sum, label) => sum + overlap(rect, label) * 1000, 0) +
          Math.abs(distance) + Math.abs(fraction - 0.5) * segment.length + 24 / segment.length
        if (score < bestScore) { bestScore = score; best = { x, y, width, height } }
      }
    }
    placed.push({ x: best.x - width / 2, y: best.y - height / 2, width, height })
    result.set(edge.id, best)
  })
  return result
}
