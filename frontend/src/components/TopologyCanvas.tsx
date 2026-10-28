import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Node,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { memo, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { computeLayout, NODE_H, NODE_W } from '@/lib/layout'
import type { Scenario } from '@/lib/types'
import { nodeMeta } from './nodeMeta'

type NetData = { node: Scenario['nodes'][number] }
type ZoneData = { name: string; cidr: string; color: string; count: number }

const NetNode = memo(({ data, selected }: NodeProps<Node<NetData>>) => {
  const n = data.node
  const meta = nodeMeta[n.type] ?? nodeMeta.server
  const Icon = meta.icon
  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-lg border bg-white px-2.5 shadow-sm transition-all duration-150',
        selected ? 'border-brand-500 ring-2 ring-brand-100' : 'border-line hover:border-brand-300 hover:shadow-md',
      )}
      style={{ width: NODE_W, height: NODE_H }}
    >
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border"
        style={{ background: `${meta.color}12`, borderColor: `${meta.color}2b`, color: meta.color }}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-medium leading-4 text-ink-900">{n.name}</div>
        <div className="mono-num truncate text-[10px] leading-4 text-ink-400">{n.ip}</div>
      </div>
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: n.status === 'running' || !n.status ? '#1F9E62' : '#D98A22' }}
      />
      <Handle type="target" position={Position.Left} id="l" className="!h-1.5 !w-1.5 !border-0 !bg-slate-300" />
      <Handle type="source" position={Position.Right} id="r" className="!h-1.5 !w-1.5 !border-0 !bg-slate-300" />
      <Handle type="target" position={Position.Top} id="t" className="!h-1.5 !w-1.5 !border-0 !bg-slate-300" />
      <Handle type="source" position={Position.Bottom} id="b" className="!h-1.5 !w-1.5 !border-0 !bg-slate-300" />
    </div>
  )
})
NetNode.displayName = 'NetNode'

const ZoneBox = memo(({ data }: NodeProps<Node<ZoneData>>) => (
  <div
    className="h-full w-full rounded-xl border"
    style={{ borderColor: `${data.color}33`, background: `${data.color}08` }}
  >
    <div className="flex items-center justify-between px-3 pt-2">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-sm" style={{ background: data.color }} />
        <span className="text-[11.5px] font-semibold" style={{ color: data.color }}>
          {data.name}
        </span>
        <span className="mono-num rounded bg-white/70 px-1 text-[9.5px] text-ink-400">{data.cidr}</span>
      </div>
      <span className="text-[10px] text-ink-400">{data.count} 节点</span>
    </div>
  </div>
))
ZoneBox.displayName = 'ZoneBox'

const nodeTypes: NodeTypes = { net: NetNode, zonebox: ZoneBox } as unknown as NodeTypes

export function TopologyCanvas({
  scenario,
  height = 520,
  withLabels = false,
  editable = false,
  selectedId,
  onSelect,
  onDragStop,
  className,
}: {
  scenario: Scenario
  height?: number | string
  withLabels?: boolean
  editable?: boolean
  selectedId?: string | null
  onSelect?: (id: string) => void
  onDragStop?: (positions: Record<string, { x: number; y: number }>) => void
  className?: string
}) {
  const layout = useMemo(() => computeLayout(scenario, { withLabels }), [scenario, withLabels])
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(layout.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layout.edges)

  useEffect(() => {
    const next = computeLayout(scenario, { withLabels })
    setNodes((prev) => {
      const posMap = new Map(prev.filter((p) => p.type === 'net').map((p) => [p.id, p.position]))
      const merged = next.nodes.map((n) =>
        n.type === 'net' && posMap.has(n.id) ? { ...n, position: posMap.get(n.id)! } : n,
      )
      return refreshZones(merged, scenario)
    })
    setEdges(next.edges)
  }, [scenario, withLabels, setNodes, setEdges])

  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => (n.type === 'net' ? { ...n, selected: n.id === selectedId } : n)),
    )
  }, [selectedId, setNodes])

  return (
    <div className={cn('relative overflow-hidden rounded-xl border border-line bg-white grid-bg', className)} style={{ height }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodesDraggable={editable}
        nodesConnectable={false}
        elementsSelectable
        minZoom={0.25}
        maxZoom={1.6}
        fitView
        fitViewOptions={{ padding: 0.16, maxZoom: 1 }}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => {
          if (node.type === 'net') onSelect?.(node.id)
        }}
        onNodeDragStop={() => {
          const positions: Record<string, { x: number; y: number }> = {}
          nodes.forEach((n) => {
            if (n.type === 'net') positions[n.id] = { x: n.position.x, y: n.position.y }
          })
          onDragStop?.(positions)
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#dfe7f1" />
        <Controls showInteractive={false} className="!shadow-sm" />
        <MiniMap
          pannable
          zoomable
          style={{ width: 112, height: 76 }}
          className="!bg-white/90"
          nodeColor={(n) => {
            if (n.type === 'zonebox') return '#eef3f9'
            const d = n.data as unknown as NetData
            return nodeMeta[d?.node?.type]?.color ?? '#94a3b8'
          }}
          maskColor="rgba(244,247,251,0.65)"
        />
      </ReactFlow>
    </div>
  )
}

function refreshZones(nodes: Node[], scenario: Scenario): Node[] {
  const posOf = new Map(nodes.filter((n) => n.type === 'net').map((n) => [n.id, n.position]))
  return nodes.map((n) => {
    if (n.type !== 'zonebox') return n
    const zoneId = n.id.replace('zonebox-', '')
    const members = scenario.nodes.filter((s) => s.zone === zoneId && posOf.has(s.id))
    if (!members.length) return n
    const xs = members.map((m) => posOf.get(m.id)!.x)
    const ys = members.map((m) => posOf.get(m.id)!.y)
    const x = Math.min(...xs) - 16
    const y = Math.min(...ys) - 50
    const w = Math.max(...xs) + NODE_W + 16 - x
    const h = Math.max(...ys) + NODE_H + 16 - y
    return { ...n, position: { x, y }, style: { ...(n.style ?? {}), width: w, height: h } }
  })
}
