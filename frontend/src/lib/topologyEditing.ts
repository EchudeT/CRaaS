import type { NodeType, Scenario, TopoNode } from './types'

export const NODE_DRAG_MIME = 'application/x-craas-node'

export interface PaletteItem {
  id: string
  name: string
  type: NodeType
  entity_type_id?: string
  category?: string
  category_name?: string
  aliases?: string[]
}

export interface NodeDrop {
  position: { x: number; y: number }
  zone?: string
  positions: Record<string, { x: number; y: number }>
}

/** 手工编辑不伪造原文证据，也不修改模型抽取结果中的其他实体和关系。 */
export function insertPaletteNode(scenario: Scenario, item: PaletteItem, drop: NodeDrop, id: string): Scenario {
  const zones = [...scenario.zones]
  let zone = zones.find((z) => z.id === drop.zone)?.id
    || zones.find((z) => z.id === `zone_${item.category}`)?.id
    || zones[0]?.id
  if (!zone) {
    zone = 'zone_manual'
    zones.push({ id: zone, name: '手工编辑区', cidr: '', color: '#0072CE' })
  }
  const count = scenario.nodes.filter((n) => item.entity_type_id ? n.entity_type_id === item.entity_type_id : n.type === item.type).length
  const node: TopoNode = {
    id, name: `${item.name}-${count + 1}`, type: item.type, zone,
    ip: '', image: '', flavor: '', cpu: 0, memory: 0, disk: 0, ports: 0,
    role: item.name, quantity: 1, attributes: {}, evidence: '', origin: 'manual',
    status: 'planned', ...drop.position,
    ...(item.entity_type_id ? { entity_type_id: item.entity_type_id, canonical_name: item.name, raw_name: item.name, category: item.category } : {}),
  }
  const nodes = [...scenario.nodes.map((n) => drop.positions[n.id] ? { ...n, ...drop.positions[n.id] } : n), node]
  return { ...scenario, zones, nodes, meta: { ...scenario.meta,
    zone_count: zones.length, node_count: nodes.length, link_count: scenario.links.length,
    host_count: nodes.reduce((sum, n) => sum + (n.quantity ?? 1), 0), deployment_ready: false,
  } }
}

/** React Flow 提供坐标转换，处理画布平移与缩放；只接受本应用节点拖拽格式。 */
export function receiveNodeDrop(
  event: { preventDefault: () => void; clientX: number; clientY: number; dataTransfer: Pick<DataTransfer, 'getData'> },
  project: (point: { x: number; y: number }) => { x: number; y: number },
  nodes: { id: string; type?: string; position: { x: number; y: number }; style?: { width?: unknown; height?: unknown } }[],
  onAdd?: (id: string, drop: NodeDrop) => void,
) {
  if (!onAdd) return
  const id = event.dataTransfer.getData(NODE_DRAG_MIME)
  if (!id) return
  event.preventDefault()
  const point = project({ x: event.clientX, y: event.clientY })
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return
  const zone = [...nodes].reverse().find((n) => n.type === 'zonebox' && point.x >= n.position.x && point.y >= n.position.y
    && point.x <= n.position.x + Number(n.style?.width || 0) && point.y <= n.position.y + Number(n.style?.height || 0))
  onAdd(id, { position: point, zone: zone?.id.replace(/^zonebox-/, ''),
    positions: Object.fromEntries(nodes.filter((n) => n.type === 'net').map((n) => [n.id, n.position])),
  })
}
