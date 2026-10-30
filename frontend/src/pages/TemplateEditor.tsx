import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  Copy,
  Rocket,
  Save,
  Trash2,
  Wand2,
  Workflow,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '@/lib/api'
import type { Scenario, Template, Validation } from '@/lib/types'
import { CodeView } from '@/components/CodeView'
import { TopologyCanvas } from '@/components/TopologyCanvas'
import { nodeMeta } from '@/components/nodeMeta'
import { Badge, Button, Card, Field, Input, Select, toast } from '@/components/ui'
import { NodePalette } from '@/components/NodePalette'
import { insertPaletteNode, type NodeDrop, type PaletteItem } from '@/lib/topologyEditing'
import { cn, copy } from '@/lib/utils'
import { TopologyEvidence } from '@/components/TopologyEvidence'
import { DataBadge } from '@/components/SceneContext'

const IMAGE_OPTIONS = [
  'router-vr-8',
  'switch-vs-8',
  'fw-ngfw-4',
  'ubuntu-2204-server',
  'win10-office',
  'kali-2024-attacker',
  'plc-s7-1200',
  'ids-snort-3',
  'cloud-internet',
]

export default function TemplateEditor() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [template, setTemplate] = useState<Template | null>(null)
  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [validation, setValidation] = useState<Validation | null>(null)
  const [codeDraft, setCodeDraft] = useState('')
  const draggedItem = useRef<PaletteItem | null>(null)
  const addAtCenter = useRef<((itemId: string) => void) | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api
      .template(id)
      .then((t) => {
        draggedItem.current = null
        setSelected(null)
        setTemplate(t)
        setScenario(t.topology)
        setCodeDraft(JSON.stringify(t.topology, null, 2))
      })
      .catch(() => toast('模板加载失败', 'error'))
  }, [id])

  useEffect(() => {
    if (!scenario) return
    const timer = setTimeout(() => {
      api.validate(scenario).then(setValidation).catch(() => setValidation(null))
    }, 350)
    return () => clearTimeout(timer)
  }, [scenario])

  const code = useMemo(() => (scenario ? JSON.stringify(scenario, null, 2) : ''), [scenario])

  useEffect(() => {
    setCodeDraft(code)
  }, [code])

  const node = scenario?.nodes.find((n) => n.id === selected) ?? null

  const imageSpec = useMemo(
    () =>
      node
        ? JSON.stringify(
            {
              image_name: node.image,
              type: node.type,
              flavor: node.flavor,
              cpu: node.cpu,
              memory: node.memory,
              disk: node.disk,
              ports: node.ports,
              ipv4: node.ip,
              zone: node.zone,
            },
            null,
            2,
          )
        : '',
    [node],
  )

  const patchNode = useCallback((patch: Record<string, unknown>) => {
    if (!selected) return
    setScenario((s) =>
      s ? { ...s, nodes: s.nodes.map((n) => (n.id === selected ? { ...n, ...patch } : n)) } : s,
    )
  }, [selected])

  function removeNode() {
    if (!selected || !scenario) return
    setScenario({
      ...scenario,
      nodes: scenario.nodes.filter((n) => n.id !== selected),
      links: scenario.links.filter((l) => l.source !== selected && l.target !== selected),
    })
    setSelected(null)
  }

  function autoLayout() {
    if (!scenario) return
    setScenario({ ...scenario, nodes: scenario.nodes.map((n) => ({ ...n, x: undefined, y: undefined })) })
  }

  function applyCode() {
    try {
      const parsed = JSON.parse(codeDraft) as Scenario
      if (!parsed.nodes || !parsed.zones) throw new Error('结构不完整')
      setScenario(parsed)
      toast('代码已应用，拓扑已刷新')
    } catch {
      toast('JSON 解析失败，请检查代码格式', 'error')
    }
  }

  const addDroppedNode = useCallback((itemId: string, drop: NodeDrop) => {
    const item = draggedItem.current
    if (!item || item.id !== itemId) return
    const id = `n_${crypto.randomUUID().replaceAll('-', '')}`
    setScenario((s) => s ? insertPaletteNode(s, item, drop, id) : s)
    setSelected(id)
    toast('已手工添加节点，可在右侧编辑属性；保存模板后生效')
  }, [])

  const registerCenter = useCallback((add: (itemId: string) => void) => { addAtCenter.current = add }, [])

  async function save() {
    if (!scenario || !template) return
    setSaving(true)
    try {
      const checked = await api.validate(scenario)
      setValidation(checked)
      if (!checked.passed) { toast('请先修复拓扑结构错误', 'error'); return }
      const t = await api.updateTemplate(template.id, { topology: scenario })
      setTemplate(t)
      toast('模板已保存')
    } catch {
      toast('保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!scenario || !template) {
    return <div className="py-20 text-center text-[12.5px] text-ink-400">加载中…</div>
  }

  return (
    <div className="space-y-3">
      {/* 顶部工具条 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Workflow className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold text-ink-900">{template.name}</span>
              <Badge className="border-brand-200 bg-brand-50 text-brand-600">{template.business_name}</Badge>
              <Badge className="border-slate-200 bg-slate-50 text-ink-500">
                {template.source === 'example' ? '内置示例' : template.source === 'llm' ? 'LLM 生成' : '规则引擎'}
              </Badge>
              <DataBadge demo={template.is_demo} />
              <span className="text-xs text-brand-600">{template.scene_name}</span>
            </div>
            <div className="mt-0.5 text-[11.5px] text-ink-400">
              {scenario.zones.length} 个区域 · {scenario.nodes.length} 个节点 · {scenario.links.length} 条链路
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={autoLayout} icon={<Wand2 className="h-3.5 w-3.5" />}>
            自动布局
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={removeNode}
            disabled={!selected}
            icon={<Trash2 className="h-3.5 w-3.5" />}
          >
            删除节点
          </Button>
          <Button variant="secondary" size="sm" onClick={save} disabled={saving} icon={<Save className="h-3.5 w-3.5" />}>
            {saving ? '保存中…' : '保存模板'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => nav(`/orchestrate/${template.id}`)}
            disabled={scenario.kind === 'logical'}
            title={scenario.kind === 'logical' ? '逻辑拓扑需先完成资源映射' : undefined}
            icon={<Rocket className="h-3.5 w-3.5" />}
          >
            去部署
          </Button>
        </div>
      </div>

      {/* 三栏 */}
      <div className="grid items-start gap-3 xl:grid-cols-[180px_minmax(0,1fr)_280px]">
        <NodePalette scenario={scenario} onDragItem={(item) => { draggedItem.current = item }} onDragEnd={() => { draggedItem.current = null }}
          onAdd={(item) => { draggedItem.current = item; addAtCenter.current?.(item.id); draggedItem.current = null }} />

        <Card className="flex h-[650px] min-w-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink-700">
              <Workflow className="h-3.5 w-3.5 text-brand-500" /> 图形编辑器
            </span>
            <span className="text-[11px] text-ink-400">从左侧拖入节点，右侧编辑属性</span>
          </div>
          <div className="flex-1 p-3">
            <TopologyCanvas
              scenario={scenario}
              height="100%"
              className="h-full min-h-[500px]"
              editable
              withLabels
              selectedId={selected}
              onSelect={setSelected}
              onAddNode={addDroppedNode}
              onAddAtCenter={registerCenter}
              onDragStop={(positions) =>
                setScenario((s) =>
                  s
                    ? {
                        ...s,
                        nodes: s.nodes.map((n) =>
                          positions[n.id] ? { ...n, x: positions[n.id].x, y: positions[n.id].y } : n,
                        ),
                      }
                    : s,
                )
              }
            />
          </div>
        </Card>

        <Card className="flex min-h-[560px] flex-col overflow-hidden xl:max-h-[650px]">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink-700">
              <CheckCircle2 className="h-3.5 w-3.5 text-brand-500" /> 拓扑检查器
            </span>
            <Badge
              className={
                validation?.passed ? 'border-ok/25 bg-ok/10 text-ok' : 'border-danger/25 bg-danger/10 text-danger'
              }
              dot
            >
              {validation?.passed ? '通过' : `${validation?.error_count ?? 0} 错误`}
            </Badge>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <div className="mb-3 grid grid-cols-2 gap-2">
              {[
                ['节点总数', validation?.stats.nodes ?? 0],
                ['连接总数', validation?.stats.links ?? 0],
                ['区域数', scenario.zones.length],
                ['网段数', validation?.stats.subnets ?? 0],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-lg border border-line bg-slate-50/60 px-2.5 py-2">
                  <div className="text-[10.5px] text-ink-400">{k}</div>
                  <div className="mono-num text-[15px] font-semibold text-ink-900">{v}</div>
                </div>
              ))}
            </div>

            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">配置检查</div>
            {node ? (
              <div className="space-y-2.5">
                <Field label="节点名称">
                  <Input value={node.name} onChange={(e) => patchNode({ name: e.target.value })} />
                </Field>
                {scenario.kind === 'logical' && (
                  <Field label="实体数量">
                    <Input type="number" min={1} value={node.quantity ?? 1} onChange={(e) => patchNode({ quantity: Number(e.target.value) })} />
                  </Field>
                )}
                {scenario.kind === 'logical' && <div className="space-y-2 rounded-lg border border-line p-2 text-[11px]">
                  {node.origin === 'manual' && <Badge className="border-amber-200 bg-amber-50 text-amber-700">手工添加</Badge>}
                  <div className="break-all text-brand-600">{node.entity_type_id || '待指定实体类型'}</div>
                  <Field label="原文依据"><Input value={node.evidence || ''} placeholder="手工补充依据，勿伪造原文" onChange={(e) => patchNode({ evidence: e.target.value })} /></Field>
                  <div className="break-words leading-5 text-ink-500">属性：{JSON.stringify(node.attributes || {}, null, 1)}</div>
                </div>}
                <div className="grid grid-cols-2 gap-2">
                  <Field label="类型">
                    <Select
                      value={node.type}
                      onChange={(v) => patchNode({ type: v })}
                      options={Object.entries(nodeMeta).map(([k, m]) => ({ value: k, label: m.label }))}
                    />
                  </Field>
                  <Field label="区域">
                    <Select
                      value={node.zone}
                      onChange={(v) => patchNode({ zone: v })}
                      options={scenario.zones.map((z) => ({ value: z.id, label: z.name }))}
                    />
                  </Field>
                </div>
                <Field label="IP 地址">
                  <Input value={node.ip} onChange={(e) => patchNode({ ip: e.target.value })} className="mono-num" />
                </Field>
                <Field label="镜像">
                  <Select
                    value={node.image}
                    onChange={(v) => patchNode({ image: v })}
                    options={IMAGE_OPTIONS.map((i) => ({ value: i, label: i }))}
                  />
                </Field>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="CPU">
                    <Input
                      type="number"
                      value={node.cpu}
                      onChange={(e) => patchNode({ cpu: Number(e.target.value) })}
                      className="mono-num"
                    />
                  </Field>
                  <Field label="内存MB">
                    <Input
                      type="number"
                      value={node.memory}
                      onChange={(e) => patchNode({ memory: Number(e.target.value) })}
                      className="mono-num"
                    />
                  </Field>
                  <Field label="磁盘GB">
                    <Input
                      type="number"
                      value={node.disk}
                      onChange={(e) => patchNode({ disk: Number(e.target.value) })}
                      className="mono-num"
                    />
                  </Field>
                </div>
                <Field label="端口数">
                  <Input
                    type="number"
                    value={node.ports}
                    onChange={(e) => patchNode({ ports: Number(e.target.value) })}
                    className="mono-num"
                  />
                </Field>

                <div className="overflow-hidden rounded-lg border border-line">
                  <div className="flex items-center justify-between border-b border-line bg-slate-50 px-2.5 py-1.5">
                    <span className="text-[10.5px] font-medium text-ink-500">镜像 JSON</span>
                    <button
                      onClick={() => {
                        copy(imageSpec)
                        toast('镜像 JSON 已复制')
                      }}
                      className="flex cursor-pointer items-center gap-1 text-[10.5px] text-brand-600 hover:underline"
                    >
                      <Copy className="h-3 w-3" /> 复制
                    </button>
                  </div>
                  <CodeView value={imageSpec} height={176} />
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-line py-6 text-center text-[11.5px] text-ink-400">
                点击画布节点进行配置
              </div>
            )}

            {validation && validation.issues.length > 0 && (
              <div className="mt-3">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">校验提示</div>
                <div className="space-y-1.5">
                  {validation.issues.slice(0, 6).map((i, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-[11px] leading-4',
                        i.level === 'error' ? 'border-danger/20 bg-danger/5 text-danger' : 'border-warn/20 bg-warn/5 text-warn',
                      )}
                    >
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      <span className="text-ink-600">{i.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {scenario.kind === 'logical' && (
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">关系编辑 · 修改后保存模板</span>
            <Button size="sm" disabled={scenario.nodes.length < 2} onClick={() => setScenario({ ...scenario, links: [...scenario.links, {
              id: `relation_${crypto.randomUUID()}`, source: scenario.nodes[0].id, target: scenario.nodes[1].id,
              relation_type: 'connects_to', interface: '', protocol: '', label: 'connects_to', directed: false,
              src_port: '', dst_port: '', cidr: '', bandwidth: '',
            }] })}>添加关系</Button>
          </div>
          {scenario.links.map((link) => {
            const patchLink = (patch: Partial<typeof link>) => setScenario({ ...scenario, links: scenario.links.map((l) => {
              if (l.id !== link.id) return l
              const updated = { ...l, ...patch }
              return { ...updated, label: [updated.interface, updated.protocol, updated.bandwidth].filter(Boolean).join(' · ') || updated.relation_type }
            }) })
            return <div key={link.id} className="grid items-end gap-2 rounded-lg border border-line p-3 lg:grid-cols-3 xl:grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_auto]">
              <Field label="起点"><Select value={link.source} onChange={(source) => patchLink({ source })} options={scenario.nodes.map((n) => ({ value: n.id, label: n.name }))} /></Field>
              <Field label="终点"><Select value={link.target} onChange={(target) => patchLink({ target })} options={scenario.nodes.map((n) => ({ value: n.id, label: n.name }))} /></Field>
              <Field label="关系类型"><Input value={link.relation_type || ''} onChange={(e) => patchLink({ relation_type: e.target.value, directed: e.target.value !== 'connects_to' })} /></Field>
              <Field label="接口 / 链路"><Input value={link.interface || ''} onChange={(e) => patchLink({ interface: e.target.value })} /></Field>
              <Field label="协议"><Input value={link.protocol || ''} onChange={(e) => patchLink({ protocol: e.target.value })} /></Field>
              <Field label="链路速率"><Input value={link.bandwidth || ''} placeholder="例如 100Gbps" onChange={(e) => patchLink({ bandwidth: e.target.value })} /></Field>
              <Button variant="ghost" onClick={() => setScenario({ ...scenario, links: scenario.links.filter((l) => l.id !== link.id) })}>删除</Button>
            </div>
          })}
          <div className="text-xs text-ink-400">逻辑关系不代表已经建立物理网络；未指定的镜像、规格和 IP 保持待配置。</div>
        </Card>
      )}

      {scenario.kind === 'logical' && <TopologyEvidence scenario={scenario} />}

      <Card className="overflow-hidden">
        <details>
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-xs font-medium text-ink-700"><Code2 className="h-4 w-4 text-brand-500" />代码编辑器 · 展开查看和编辑 JSON</summary>
          <div className="flex items-center justify-end gap-2 border-y border-line px-3 py-2">
            <Button variant="ghost" size="sm" onClick={() => setCodeDraft(code)}>重置</Button>
            <Button variant="outline" size="sm" onClick={applyCode}>应用代码</Button>
          </div>
          <CodeView value={codeDraft} onChange={setCodeDraft} height={400} />
        </details>
      </Card>
    </div>
  )
}
