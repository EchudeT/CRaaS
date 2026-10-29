import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Handle,
  EdgeLabelRenderer,
  getBezierPath,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useNodesInitialized,
  useReactFlow,
  useUpdateNodeInternals,
  type Node,
  type NodeProps,
  type NodeTypes,
  type EdgeProps,
  type EdgeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { memo, useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { placeEdgeLabels, type LabelPlacement } from '@/lib/edgeLabels'
import { routeEdges, type EdgeRoute } from '@/lib/edgeRouting'
import { computeLayout, INSTANCE_GAP, INSTANCE_HEADER, INSTANCE_PAD, nodeDimensions, NODE_H, NODE_W } from '@/lib/layout'
import type { Scenario } from '@/lib/types'
import { nodeMeta } from './nodeMeta'

type NetData = { node: Scenario['nodes'][number]; dimensions: ReturnType<typeof nodeDimensions> }
type ZoneData = { name: string; cidr: string; color: string; count: number }

function DeviceCard({ node: n, selected, index }: { node: NetData['node']; selected: boolean; index?: number }) {
  const meta = nodeMeta[n.type] ?? nodeMeta.server
  const Icon = meta.icon
  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-lg border bg-white px-2.5 shadow-sm transition-all duration-150',
        selected ? 'border-brand-500 ring-2 ring-brand-100' : 'border-line hover:border-brand-300 hover:shadow-md',
      )}
      style={{ width: NODE_W, height: NODE_H }}
      title={index == null ? n.name : `${n.name} #${index}（逻辑组内展示，属性按组编辑）`}
    >
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border"
        style={{ background: `${meta.color}12`, borderColor: `${meta.color}2b`, color: meta.color }}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex gap-1 text-[12px] font-medium leading-4 text-ink-900"><span className="truncate">{n.name}</span><span className="shrink-0">{index != null ? `#${index}` : n.quantity && n.quantity > 1 ? `×${n.quantity}` : ''}</span></div>
        <div className="mono-num truncate text-[10px] leading-4 text-ink-400">{index == null ? n.ip || n.entity_type_id || '未指定 IP' : n.entity_type_id || '组内设备'}</div>
      </div>
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        title={n.status === 'planned' ? '逻辑节点，尚未部署' : n.status}
        style={{ background: n.status === 'planned' ? '#94a3b8' : n.status === 'running' || !n.status ? '#1F9E62' : '#D98A22' }}
      />
    </div>
  )
}

const NetNode = memo(({ id, data, selected = false }: NodeProps<Node<NetData>>) => {
  const { node: n, dimensions: size } = data
  const updateNodeInternals = useUpdateNodeInternals()
  useEffect(() => { updateNodeInternals(id) }, [id, size.width, size.height, updateNodeInternals])
  return (
    <div style={{ width: size.width, height: size.height }}>
      {size.count > 1 ? (
        <div className={cn('h-full rounded-xl border bg-slate-50/95', selected ? 'border-brand-500 ring-2 ring-brand-100' : 'border-slate-300')}>
          <div className="flex items-center justify-between gap-2 px-3 text-[11px] text-ink-500" style={{ height: INSTANCE_HEADER }}>
            <span className="truncate font-medium">{n.name}</span>
            <span className="shrink-0">数量 {size.quantity} · 按组编辑</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${size.columns}, ${NODE_W}px)`, gap: INSTANCE_GAP, padding: `0 ${INSTANCE_PAD}px` }}>
            {Array.from({ length: size.count }, (_, i) => <DeviceCard key={i} node={n} selected={selected} index={i + 1} />)}
          </div>
          {size.quantity > size.count && <div className="px-3 pt-1 text-[10px] text-ink-400">另有 {size.quantity - size.count} 个未展开（单组最多展示 {size.count} 个）</div>}
        </div>
      ) : <DeviceCard node={n} selected={selected} />}
      <Handle type="target" position={Position.Left} id="l" className="!h-1.5 !w-1.5 !border-0 !bg-slate-300" />
      <Handle type="source" position={Position.Right} id="r" className="!h-1.5 !w-1.5 !border-0 !bg-slate-300" />
      <Handle type="target" position={Position.Top} id="t" className="!h-1.5 !w-1.5 !border-0 !bg-slate-300" />
      <Handle type="source" position={Position.Bottom} id="b" className="!h-1.5 !w-1.5 !border-0 !bg-slate-300" />
      <Handle type="source" position={Position.Left} id="l" className="!h-1.5 !w-1.5 !border-0 !bg-slate-300" />
      <Handle type="source" position={Position.Top} id="t" className="!h-1.5 !w-1.5 !border-0 !bg-slate-300" />
      <Handle type="target" position={Position.Right} id="r" className="!h-1.5 !w-1.5 !border-0 !bg-slate-300" />
      <Handle type="target" position={Position.Bottom} id="b" className="!h-1.5 !w-1.5 !border-0 !bg-slate-300" />
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

const LabeledEdge = memo((props: EdgeProps) => {
  const [path, centerX, centerY] = getBezierPath(props)
  const route = props.data?.route as EdgeRoute | undefined
  const placement = props.data?.labelPlacement as LabelPlacement | undefined
  const anchor = route?.center ?? { x: centerX, y: centerY }
  const x = placement?.x ?? anchor.x, y = placement?.y ?? anchor.y
  const shifted = placement && Math.hypot(x - anchor.x, y - anchor.y) > 24
  return <>
    <BaseEdge id={props.id} path={route?.path ?? path} style={props.style} markerStart={props.markerStart} markerEnd={props.markerEnd} interactionWidth={props.interactionWidth} />
    {props.label && shifted && <path d={`M ${anchor.x} ${anchor.y} L ${x} ${y}`} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="2 3" fill="none" pointerEvents="none" />}
    {props.label && <EdgeLabelRenderer>
      <div className="topology-edge-label nodrag nopan" title={String(props.label)}
        style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`, width: placement?.width }}>
        {props.label}
      </div>
    </EdgeLabelRenderer>}
  </>
})
LabeledEdge.displayName = 'LabeledEdge'
const edgeTypes: EdgeTypes = { default: LabeledEdge }

function FitLayout({ nodes, edges, request }: { nodes: Node[]; edges: ReturnType<typeof routeEdges>; request: number }) {
  const { fitBounds } = useReactFlow()
  const initialized = useNodesInitialized()
  const shape = nodes.filter((n) => n.type === 'net').map((n) => `${n.id}:${n.style?.width}:${n.style?.height}`).join('|') + edges.map((edge) => String(!!edge.label)).join('')
  useEffect(() => {
    if (!initialized) return
    const points = nodes.flatMap((node) => [node.position, { x: node.position.x + Number(node.style?.width || NODE_W), y: node.position.y + Number(node.style?.height || NODE_H) }])
    edges.forEach((edge) => {
      const route = edge.data?.route as EdgeRoute | undefined
      if (route) points.push(...route.points)
      const label = edge.data?.labelPlacement as LabelPlacement | undefined
      if (label) points.push({ x: label.x - label.width / 2, y: label.y - label.height / 2 }, { x: label.x + label.width / 2, y: label.y + label.height / 2 })
    })
    if (!points.length) return
    const x = Math.min(...points.map((p) => p.x)), y = Math.min(...points.map((p) => p.y))
    const bounds = { x, y, width: Math.max(...points.map((p) => p.x)) - x, height: Math.max(...points.map((p) => p.y)) - y }
    const frame = requestAnimationFrame(() => { void fitBounds(bounds, { padding: 0.12 }) })
    return () => cancelAnimationFrame(frame)
  }, [shape, request, initialized, fitBounds])
  return null
}

interface CanvasProps {
  scenario: Scenario
  height?: number | string
  withLabels?: boolean
  editable?: boolean
  selectedId?: string | null
  onSelect?: (id: string) => void
  onDragStop?: (positions: Record<string, { x: number; y: number }>) => void
  className?: string
}

export function TopologyCanvas(props: CanvasProps) {
  return <ReactFlowProvider><TopologyCanvasInner {...props} /></ReactFlowProvider>
}

function TopologyCanvasInner({
  scenario,
  height = 520,
  withLabels = false,
  editable = false,
  selectedId,
  onSelect,
  onDragStop,
  className,
}: CanvasProps) {
  const { zoomIn, zoomOut } = useReactFlow()
  const [fitRequest, setFitRequest] = useState(0)
  const [expandQuantities, setExpandQuantities] = useState(scenario.kind === 'logical')
  const [showLabels, setShowLabels] = useState(true)
  const hasQuantities = scenario.nodes.some((n) => (n.quantity ?? 1) > 1)
  const layout = useMemo(() => computeLayout(scenario, { withLabels: withLabels && showLabels, expandQuantities }), [scenario, withLabels, showLabels, expandQuantities])
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(layout.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layout.edges)
  const labeledEdges = useMemo(() => {
    const routed = routeEdges(nodes, edges)
    const placements = placeEdgeLabels(nodes, routed)
    return routed.map((edge) => ({ ...edge, data: { ...edge.data, labelPlacement: placements.get(edge.id) } }))
  }, [nodes, edges])

  useEffect(() => {
    setNodes(layout.nodes.map((n) => n.type === 'net' ? { ...n, selected: n.id === selectedId } : n))
    setEdges(layout.edges)
  }, [layout, setNodes, setEdges])
  useEffect(() => {
    setNodes((previous) => previous.map((node) => node.type === 'net' ? { ...node, selected: node.id === selectedId } : node))
  }, [selectedId, setNodes])

  function arrange() {
    const next = computeLayout(scenario, { withLabels: withLabels && showLabels, expandQuantities, ignoreSavedPositions: true })
    setNodes(next.nodes.map((node) => ({ ...node, selected: node.id === selectedId })))
    setEdges(next.edges)
    if (editable) onDragStop?.(Object.fromEntries(next.nodes.filter((node) => node.type === 'net').map((node) => [node.id, node.position])))
    setFitRequest((request) => request + 1)
  }

  return (
    <div className={cn('relative flex flex-col overflow-hidden rounded-xl border border-line bg-white', className)} style={{ height }}>
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-slate-50 px-3 py-2 text-[11px]">
        <button type="button" onClick={arrange} className="rounded border border-line bg-white px-2 py-1 text-ink-700 hover:border-brand-300">自动布局</button>
        <button type="button" onClick={() => setFitRequest((request) => request + 1)} className="rounded border border-line bg-white px-2 py-1 text-ink-700 hover:border-brand-300">适应画布</button>
        <button type="button" aria-label="缩小" onClick={() => void zoomOut()} className="rounded border border-line bg-white px-2 py-1">−</button>
        <button type="button" aria-label="放大" onClick={() => void zoomIn()} className="rounded border border-line bg-white px-2 py-1">＋</button>
        {hasQuantities && <label className="flex cursor-pointer items-center gap-1.5 text-ink-700"><input type="checkbox" checked={expandQuantities} onChange={(e) => setExpandQuantities(e.target.checked)} />按数量展开</label>}
        {withLabels && <label className="flex cursor-pointer items-center gap-1.5 text-ink-700"><input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />显示连线文字</label>}
        {hasQuantities && expandQuantities && <span className="text-ink-400">编号仅用于展示，连线表示组间关系</span>}
      </div>
      <div className="relative min-h-0 flex-1">
      <ReactFlow
        nodes={nodes}
        edges={labeledEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodesDraggable={editable}
        nodesConnectable={false}
        elementsSelectable
        elevateEdgesOnSelect={false}
        minZoom={0.05}
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
          setNodes((prev) => refreshZones(prev))
        }}
      >
        <FitLayout nodes={nodes} edges={labeledEdges} request={fitRequest} />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#dfe7f1" />
      </ReactFlow>
      </div>
    </div>
  )
}

function refreshZones(nodes: Node[]): Node[] {
  return nodes.map((n) => {
    if (n.type !== 'zonebox') return n
    const zoneId = n.id.replace('zonebox-', '')
    const members = nodes.filter((s) => s.type === 'net' && (s.data as NetData).node.zone === zoneId)
    if (!members.length) return n
    const xs = members.map((m) => m.position.x)
    const ys = members.map((m) => m.position.y)
    const x = Math.min(...xs) - 16
    const y = Math.min(...ys) - 50
    const w = Math.max(...members.map((m) => m.position.x + (m.data as NetData).dimensions.width)) + 16 - x
    const h = Math.max(...members.map((m) => m.position.y + (m.data as NetData).dimensions.height)) + 16 - y
    return { ...n, position: { x, y }, style: { ...(n.style ?? {}), width: w, height: h } }
  })
}
