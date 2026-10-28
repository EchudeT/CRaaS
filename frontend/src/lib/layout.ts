import type { Edge, Node } from '@xyflow/react'
import type { Scenario, TopoNode } from './types'

export const NODE_W = 168
export const NODE_H = 54
const GAP_Y = 20
const PAD = 14
const HEADER = 30
const COL_GAP = 36
const ROW_GAP = 32
const COLS = 5
const PANEL_W = NODE_W + PAD * 2

export interface LayoutResult {
  nodes: Node[]
  edges: Edge[]
  zoneRects: { id: string; name: string; cidr: string; color: string; x: number; y: number; w: number; h: number; count: number }[]
}

function defaultPositions(scenario: Scenario): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>()
  const zones = scenario.zones
  const byZone = new Map<string, TopoNode[]>()
  zones.forEach((z) => byZone.set(z.id, []))
  scenario.nodes.forEach((n) => {
    if (!byZone.has(n.zone)) byZone.set(n.zone, [])
    byZone.get(n.zone)!.push(n)
  })

  const panelHeights = zones.map((z) => {
    const n = byZone.get(z.id)?.length ?? 0
    return HEADER + PAD * 2 + Math.max(n, 1) * NODE_H + Math.max(n - 1, 0) * GAP_Y
  })

  let y = 0
  for (let row = 0; row * COLS < zones.length; row++) {
    const slice = zones.slice(row * COLS, row * COLS + COLS)
    const maxH = Math.max(...slice.map((_, i) => panelHeights[row * COLS + i]), 120)
    slice.forEach((z, col) => {
      const baseX = col * (PANEL_W + COL_GAP)
      // 列间交错，避免区域汇聚设备排成一条直线导致连线重叠
      const baseY = y + (col % 2) * 34
      ;(byZone.get(z.id) ?? []).forEach((n, i) => {
        pos.set(n.id, {
          x: baseX + PAD,
          y: baseY + HEADER + PAD + i * (NODE_H + GAP_Y),
        })
      })
    })
    y += maxH + 34 + ROW_GAP
  }
  return pos
}

export function computeLayout(
  scenario: Scenario,
  opts: { withLabels?: boolean } = {},
): LayoutResult {
  const defaults = defaultPositions(scenario)
  const pos = new Map<string, { x: number; y: number }>()
  scenario.nodes.forEach((n) => {
    const fallback = defaults.get(n.id) ?? { x: 0, y: 0 }
    pos.set(n.id, n.x != null && n.y != null ? { x: n.x, y: n.y } : fallback)
  })

  const nodes: Node[] = []

  const zoneRects = scenario.zones.map((z) => {
    const members = scenario.nodes.filter((n) => n.zone === z.id)
    if (members.length === 0) {
      const p = defaults.get(`zone:${z.id}`) ?? { x: 0, y: 0 }
      return { id: z.id, name: z.name, cidr: z.cidr, color: z.color, x: p.x, y: p.y, w: PANEL_W, h: 96, count: 0 }
    }
    const xs = members.map((m) => pos.get(m.id)!.x)
    const ys = members.map((m) => pos.get(m.id)!.y)
    const minX = Math.min(...xs) - PAD
    const minY = Math.min(...ys) - PAD - HEADER
    const maxX = Math.max(...xs) + NODE_W + PAD
    const maxY = Math.max(...ys) + NODE_H + PAD
    return { id: z.id, name: z.name, cidr: z.cidr, color: z.color, x: minX, y: minY, w: maxX - minX, h: maxY - minY, count: members.length }
  })

  zoneRects.forEach((r) => {
    nodes.push({
      id: `zonebox-${r.id}`,
      type: 'zonebox',
      position: { x: r.x, y: r.y },
      data: { name: r.name, cidr: r.cidr, color: r.color, count: r.count },
      style: { width: r.w, height: r.h },
      draggable: false,
      selectable: false,
      focusable: false,
      zIndex: 0,
    })
  })

  scenario.nodes.forEach((n) => {
    const p = pos.get(n.id)!
    nodes.push({
      id: n.id,
      type: 'net',
      position: p,
      data: { node: n },
      zIndex: 2,
    })
  })

  const edges: Edge[] = scenario.links.map((l) => {
    const a = pos.get(l.source)
    const b = pos.get(l.target)
    let sourceHandle = 'r'
    let targetHandle = 'l'
    if (a && b) {
      const dx = b.x - a.x
      const dy = b.y - a.y
      if (Math.abs(dy) > Math.abs(dx)) {
        sourceHandle = dy > 0 ? 'b' : 't'
        targetHandle = dy > 0 ? 't' : 'b'
      } else {
        sourceHandle = dx > 0 ? 'r' : 'l'
        targetHandle = dx > 0 ? 'l' : 'r'
      }
    }
    return {
      id: l.id,
      source: l.source,
      target: l.target,
      sourceHandle,
      targetHandle,
      type: 'default',
      animated: l.bandwidth.includes('10G'),
      label: opts.withLabels ? `${l.src_port} · ${l.cidr || l.bandwidth}` : undefined,
      labelShowBg: true,
      labelBgPadding: [4, 2] as [number, number],
      labelBgStyle: { fill: '#ffffff', fillOpacity: 0.92, stroke: '#E3E9F0' },
      labelStyle: { fontSize: 9, fill: '#5A6B80', fontFamily: 'ui-monospace, monospace' },
      data: { link: l },
    }
  })

  return { nodes, edges, zoneRects }
}

export function applyPositions(scenario: Scenario, nodes: Node[]): Scenario {
  const map = new Map(nodes.map((n) => [n.id, n.position]))
  return {
    ...scenario,
    nodes: scenario.nodes.map((n) => {
      const p = map.get(n.id)
      return p ? { ...n, x: Math.round(p.x), y: Math.round(p.y) } : n
    }),
  }
}
