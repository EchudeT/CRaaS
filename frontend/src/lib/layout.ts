import { MarkerType, type Edge, type Node } from '@xyflow/react'
import type { Scenario, TopoNode } from './types'

export const NODE_W = 168
export const NODE_H = 54
const GAP_Y = 72
const PAD = 24
const HEADER = 38
const COL_GAP = 160
const ROW_GAP = 88
const COLS = 3
const PANEL_W = NODE_W + PAD * 2
export const INSTANCE_GAP = 12
export const INSTANCE_PAD = 12
export const INSTANCE_HEADER = 32
export const MAX_VISIBLE_INSTANCES = 50

export function nodeDimensions(node: TopoNode, expandQuantities = false) {
  const quantity = Number.isSafeInteger(node.quantity) && node.quantity! > 1 ? node.quantity! : 1
  const count = expandQuantities ? Math.min(quantity, MAX_VISIBLE_INSTANCES) : 1
  const columns = Math.min(count, 3)
  const rows = Math.ceil(count / columns)
  return {
    quantity, count, columns,
    width: count === 1 ? NODE_W : INSTANCE_PAD * 2 + columns * NODE_W + (columns - 1) * INSTANCE_GAP,
    height: count === 1 ? NODE_H : INSTANCE_HEADER + INSTANCE_PAD + rows * NODE_H + (rows - 1) * INSTANCE_GAP + (quantity > count ? 24 : 0),
  }
}

export interface LayoutResult {
  nodes: Node[]
  edges: Edge[]
  zoneRects: { id: string; name: string; cidr: string; color: string; x: number; y: number; w: number; h: number; count: number }[]
}

function defaultPositions(scenario: Scenario, expandQuantities: boolean): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>()
  const zones = scenario.zones
  const byZone = new Map<string, TopoNode[]>()
  zones.forEach((z) => byZone.set(z.id, []))
  scenario.nodes.forEach((n) => {
    if (!byZone.has(n.zone)) byZone.set(n.zone, [])
    byZone.get(n.zone)!.push(n)
  })

  const panelSizes = zones.map((z) => {
    const members = byZone.get(z.id) ?? []
    const sizes = members.map((n) => nodeDimensions(n, expandQuantities))
    return {
      width: Math.max(NODE_W, ...sizes.map((s) => s.width)) + PAD * 2,
      height: HEADER + PAD * 2 + (sizes.length ? sizes.reduce((sum, s) => sum + s.height, 0) : NODE_H) + Math.max(sizes.length - 1, 0) * GAP_Y,
    }
  })

  let y = 0
  for (let row = 0; row * COLS < zones.length; row++) {
    const slice = zones.slice(row * COLS, row * COLS + COLS)
    const maxH = Math.max(...slice.map((_, i) => panelSizes[row * COLS + i].height), 120)
    let baseX = 0
    slice.forEach((z, col) => {
      // 列间交错，避免区域汇聚设备排成一条直线导致连线重叠
      const baseY = y + (col % 2) * 34
      pos.set(`zone:${z.id}`, { x: baseX, y: baseY })
      let offsetY = HEADER + PAD
      ;(byZone.get(z.id) ?? []).forEach((n) => {
        pos.set(n.id, {
          x: baseX + PAD,
          y: baseY + offsetY,
        })
        offsetY += nodeDimensions(n, expandQuantities).height + GAP_Y
      })
      baseX += panelSizes[row * COLS + col].width + COL_GAP
    })
    y += maxH + 34 + ROW_GAP
  }
  return pos
}

export function computeLayout(
  scenario: Scenario,
  opts: { withLabels?: boolean; expandQuantities?: boolean; ignoreSavedPositions?: boolean } = {},
): LayoutResult {
  const expandQuantities = opts.expandQuantities ?? scenario.kind === 'logical'
  const defaults = defaultPositions(scenario, expandQuantities)
  const pos = new Map<string, { x: number; y: number }>()
  scenario.nodes.forEach((n) => {
    const fallback = defaults.get(n.id) ?? { x: 0, y: 0 }
    pos.set(n.id, !opts.ignoreSavedPositions && n.x != null && n.y != null ? { x: n.x, y: n.y } : fallback)
  })

  // Older templates may store positions spaced for compact cards. Keep their anchors
  // where possible, moving overlapping expanded groups down without changing the data.
  if (expandQuantities) {
    const placed: { x: number; y: number; width: number; height: number }[] = []
    scenario.nodes.forEach((n) => {
      const p = pos.get(n.id)!
      const size = nodeDimensions(n, true)
      let collision
      // 拖入的手工节点保持用户指定落点；点击自动布局时仍正常参与排布。
      if (n.origin !== 'manual' || n.x == null || n.y == null || opts.ignoreSavedPositions) {
        do {
          collision = placed.find((r) => p.x < r.x + r.width + GAP_Y && p.x + size.width + GAP_Y > r.x && p.y < r.y + r.height + GAP_Y && p.y + size.height + GAP_Y > r.y)
          if (collision) p.y = collision.y + collision.height + GAP_Y
        } while (collision)
      }
      placed.push({ ...p, width: size.width, height: size.height })
    })
  }

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
    const maxX = Math.max(...members.map((m) => pos.get(m.id)!.x + nodeDimensions(m, expandQuantities).width)) + PAD
    const maxY = Math.max(...members.map((m) => pos.get(m.id)!.y + nodeDimensions(m, expandQuantities).height)) + PAD
    return { id: z.id, name: z.name, cidr: z.cidr, color: z.color, x: minX, y: minY, w: maxX - minX, h: maxY - minY, count: members.reduce((sum, m) => sum + nodeDimensions(m, expandQuantities).count, 0) }
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
    const dimensions = nodeDimensions(n, expandQuantities)
    nodes.push({
      id: n.id,
      type: 'net',
      position: p,
      data: { node: n, dimensions },
      style: { width: dimensions.width, height: dimensions.height },
      zIndex: 2,
    })
  })

  const edges: Edge[] = scenario.links.map((l) => {
    const a = pos.get(l.source)
    const b = pos.get(l.target)
    let sourceHandle = 'r'
    let targetHandle = 'l'
    if (a && b) {
      const sourceSize = nodeDimensions(scenario.nodes.find((n) => n.id === l.source)!, expandQuantities)
      const targetSize = nodeDimensions(scenario.nodes.find((n) => n.id === l.target)!, expandQuantities)
      const dx = b.x + targetSize.width / 2 - a.x - sourceSize.width / 2
      const dy = b.y + targetSize.height / 2 - a.y - sourceSize.height / 2
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
      zIndex: 1,
      animated: (l.bandwidth || '').includes('10G'),
      label: opts.withLabels ? (l.label || [l.interface, l.protocol, l.bandwidth].filter(Boolean).join(' · ') || l.relation_type || `${l.src_port} · ${l.cidr || l.bandwidth}`) : undefined,
      markerEnd: l.directed ? { type: MarkerType.ArrowClosed } : undefined,
      style: l.relation_type && l.relation_type !== 'connects_to' ? { strokeDasharray: '5 3' } : undefined,
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
