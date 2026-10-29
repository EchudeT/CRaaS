import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileJson,
  Loader2,
  Network,
  Save,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Meta } from '@/lib/api'
import type { GenerateResult } from '@/lib/types'
import { CodeView } from '@/components/CodeView'
import { TopologyCanvas } from '@/components/TopologyCanvas'
import { Badge, Button, Card, CardHeader, Field, Input, Modal, Select, Textarea, Tabs, toast } from '@/components/ui'
import { cn } from '@/lib/utils'

const SCENE_PRESETS = [
  { name: '5G 核心网', description: '创建通信网络及服务场景：部署2个AMF实例、1个SMF和1个UPF。AMF通过N11接口连接SMF，SMF通过N4/PFCP接口控制UPF。' },
  { name: '数据中心', description: '创建新型数据中心网络及服务场景：部署2台骨干接入路由器AR、2台资源池出口路由器CE和2台SDN TOR交换机。AR通过100GE链路连接CE，CE通过25GE链路连接SDN TOR交换机。' },
  { name: '城域网', description: '创建新型城域网及服务场景：部署2台核心PTN设备、4台汇聚PTN设备、6台接入PTN设备。核心PTN通过100GE链路连接汇聚PTN，汇聚PTN通过10GE链路连接接入PTN。' },
]

export default function TopologyBuild() {
  const nav = useNavigate()
  const [meta, setMeta] = useState<Meta | null>(null)
  const [desc, setDesc] = useState(
    SCENE_PRESETS[0].description,
  )
  const [industry, setIndustry] = useState('general')
  const [business, setBusiness] = useState('drill')
  const [loading, setLoading] = useState(false)
  const [scene, setScene] = useState('auto')
  const [stage, setStage] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const mounted = useRef(true)
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [tab, setTab] = useState('topo')
  const [selected, setSelected] = useState<string | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')

  useEffect(() => {
    mounted.current = true
    api.meta().then(setMeta).catch(() => setMeta(null))
    return () => { mounted.current = false }
  }, [])

  const code = useMemo(() => {
    if (!result) return '// 等待生成场景描述代码…'
    return JSON.stringify(result.scenario, null, 2)
  }, [result])

  async function generate() {
    if (!desc.trim()) {
      toast('请先描述要构建的场景', 'error')
      return
    }
    setLoading(true)
    setResult(null)
    setError('')
    setElapsed(0)
    setStage('提交生成任务…')
    const started = Date.now()
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    try {
      const currentMeta = await api.meta()
      setMeta(currentMeta)
      let job = await api.startGeneration({ description: desc, industry, business, scene })
      while (job.status === 'queued' || job.status === 'running') {
        if (!mounted.current) return
        setStage(job.status === 'queued' ? '等待模型处理…' : `${job.stage === 'repairing' ? '正在修复并校验结果' : 'AI 正在抽取实体与关系'} · 已接收 ${job.characters.toLocaleString()} 字符`)
        await new Promise((resolve) => setTimeout(resolve, 1500))
        if (!mounted.current) return
        job = await api.generationJob(job.id)
      }
      if (job.status === 'failed' || !job.result) throw new Error(job.error || '生成失败')
      const r = job.result
      setResult(r)
      setTab('topo')
      setSelected(null)
      toast(`已由 ${r.model || 'AI'} 生成 ${r.scenario.nodes.length} 个逻辑节点 / ${r.scenario.links.length} 条关系`)
    } catch (e) {
      const message = e instanceof Error ? e.message : '生成失败，请检查后端服务'
      if (mounted.current) { setError(message); toast(message, 'error') }
    } finally {
      clearInterval(timer)
      if (mounted.current) setLoading(false)
    }
  }

  async function saveTemplate() {
    if (!result) return
    try {
      const t = await api.createTemplate({
        name: saveName || result.scenario.name,
        description: result.scenario.description,
        industry: result.scenario.industry,
        business: result.scenario.business,
        topology: result.scenario,
        source: result.generator,
      })
      toast('已保存为场景模板')
      nav(`/templates/${t.id}`)
    } catch {
      toast('保存失败', 'error')
    }
  }

  const node = result?.scenario.nodes.find((n) => n.id === selected) ?? null

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[400px_minmax(0,1fr)]">
        {/* 左：输入 */}
        <Card className="flex flex-col">
          <CardHeader
            title="描述场景"
            desc="描述通信网络、数据中心或城域网，AI 抽取实体、数量和连接关系"
            icon={<Wand2 className="h-4 w-4" />}
            right={
              <Badge className={meta?.llm.ready ? 'border-ok/25 bg-ok/10 text-ok' : 'border-slate-200 bg-slate-50 text-ink-500'} dot>
                {meta?.llm.ready ? `AI · ${meta.llm.model}` : '模型未配置'}
              </Badge>
            }
          />
          <div className="flex flex-1 flex-col gap-3 px-5 py-4">
            <Textarea
              value={desc}
              disabled={loading}
              onChange={(e) => setDesc(e.target.value)}
              rows={9}
              placeholder="描述设备、数量和关系，例如：AMF 通过 N11 接口连接 SMF…"
              className="resize-none"
            />
            <Field label="网络场景">
              <Select value={scene} onChange={setScene} options={[
                { value: 'auto', label: '自动识别场景' },
                ...(meta?.scenes ?? []).map((s) => ({ value: s.id, label: s.name })),
              ]} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="行业选择">
                <Select
                  value={industry}
                  onChange={setIndustry}
                  options={(meta?.industries ?? [{ id: 'general', name: '通用场景' }]).map((i) => ({
                    value: i.id,
                    label: i.name,
                  }))}
                />
              </Field>
              <Field label="业务类型">
                <Select
                  value={business}
                  onChange={setBusiness}
                  options={(meta?.business ?? []).map((b) => ({ value: b.id, label: b.name }))}
                />
              </Field>
            </div>

            <div>
              <div className="mb-1.5 text-[11.5px] text-ink-400">示例场景</div>
              <div className="flex flex-wrap gap-1.5">
                {SCENE_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => { setDesc(p.description); setScene('auto') }}
                    disabled={loading}
                    className="cursor-pointer rounded-md border border-line bg-white px-2 py-1 text-[11.5px] text-ink-700 transition-colors hover:border-brand-300 hover:text-brand-600"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-auto flex items-center gap-2 pt-1">
              <Button variant="primary" onClick={generate} disabled={loading} icon={loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}>
                {loading ? '生成中…' : '生成拓扑图'}
              </Button>
              <Button
                variant="secondary"
                disabled={!result}
                onClick={() => setSaveOpen(true)}
                icon={<Save className="h-3.5 w-3.5" />}
              >
                保存为场景模板
              </Button>
            </div>

            {loading && (
              <div role="status" className="space-y-1 rounded-lg border border-brand-100 bg-brand-50/60 px-3 py-2.5 text-[11.5px] text-ink-700">
                <div className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />{stage}</div>
                <div>已用时 {elapsed} 秒。长需求可能需要 1–3 分钟。</div>
              </div>
            )}
            {error && <div role="alert" className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-[12px] text-danger">{error}</div>}
          </div>
        </Card>

        {/* 右：结果 */}
        <Card className="flex min-w-0 flex-col">
          <CardHeader
            title="生成结果"
            desc={result ? `${result.scenario.zones.length} 个区域 · ${result.scenario.nodes.length} 个逻辑节点（总数量 ${result.scenario.nodes.reduce((sum, n) => sum + (n.quantity ?? 1), 0)}）· ${result.scenario.links.length} 条关系` : '生成后可查看代码与拓扑'}
            icon={<Network className="h-4 w-4" />}
            right={
              <Tabs
                value={tab}
                onChange={setTab}
                items={[
                  { value: 'topo', label: '拓扑预览' },
                  { value: 'code', label: 'IaC 代码' },
                ]}
              />
            }
          />
          <div className="min-w-0 flex-1 px-4 pb-4 pt-3">
            {result ? (
              tab === 'topo' ? (
                <TopologyCanvas
                  scenario={result.scenario}
                  withLabels
                  height={560}
                  selectedId={selected}
                  onSelect={setSelected}
                />
              ) : (
                <div className="overflow-hidden rounded-xl border border-line">
                  <div className="flex items-center justify-between border-b border-line bg-slate-50 px-3 py-1.5">
                    <span className="flex items-center gap-1.5 text-[11.5px] text-ink-500">
                      <FileJson className="h-3.5 w-3.5" /> scenario.json
                    </span>
                    <Badge className="border-slate-200 bg-white text-ink-400">{result.generator}</Badge>
                  </div>
                  <CodeView value={code} height={526} />
                </div>
              )
            ) : (
              <div className="flex h-[560px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line bg-slate-50/50 text-ink-400">
                <Network className="h-8 w-8" />
                <div className="text-[12.5px]">左侧输入场景描述后点击「生成拓扑图」</div>
                <div className="text-[11px]">支持三类网络场景的实体、数量、接口和关系抽取</div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* 校验与节点详情 */}
      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader
            title="拓扑校验"
            desc="检查实体引用、关系端点与数量；逻辑拓扑中的未知参数保持为空"
            icon={<CheckCircle2 className="h-4 w-4" />}
            right={
              result ? (
                <div className="flex items-center gap-2">
                  <Badge className={result.validation.passed ? 'border-ok/25 bg-ok/10 text-ok' : 'border-danger/25 bg-danger/10 text-danger'} dot>
                    {result.validation.passed ? '校验通过' : `${result.validation.error_count} 个错误`}
                  </Badge>
                  <Badge className="border-warn/25 bg-warn/10 text-warn">{result.validation.warn_count} 个告警</Badge>
                </div>
              ) : null
            }
          />
          <div className="px-5 py-4">
            {result ? (
              result.validation.issues.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-ok/20 bg-ok/5 px-3 py-3 text-[12.5px] text-ok">
                  <CheckCircle2 className="h-4 w-4" />
                  逻辑结构校验通过，可保存并编辑。真实部署前还需映射镜像、规格与网络。
                </div>
              ) : (
                <div className="space-y-1.5">
                  {result.validation.issues.map((i, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px]',
                        i.level === 'error' ? 'border-danger/20 bg-danger/5 text-danger' : 'border-warn/20 bg-warn/5 text-warn',
                      )}
                    >
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span className="text-ink-700">
                        <span className="mr-1 font-mono text-[10.5px] opacity-70">{i.code}</span>
                        {i.message}
                      </span>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {[
                  ['区域数', '—'],
                  ['节点数', '—'],
                  ['链路数', '—'],
                  ['网段数', '—'],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-line bg-slate-50/60 px-3 py-2.5">
                    <div className="text-[11px] text-ink-400">{k}</div>
                    <div className="mt-1 text-[16px] font-semibold text-ink-400">{v}</div>
                  </div>
                ))}
              </div>
            )}
            {result && (
              <div className="mt-3 grid grid-cols-4 gap-3">
                {[
                  ['区域数', result.validation.stats.zones],
                  ['节点数', result.validation.stats.nodes],
                  ['链路数', result.validation.stats.links],
                  ['网段数', result.validation.stats.subnets],
                ].map(([k, v]) => (
                  <div key={k as string} className="rounded-lg border border-line bg-slate-50/60 px-3 py-2.5">
                    <div className="text-[11px] text-ink-400">{k}</div>
                    <div className="mono-num mt-1 text-[16px] font-semibold text-ink-900">{v}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="节点属性" desc={node ? node.name : '在拓扑中点击节点查看'} icon={<Network className="h-4 w-4" />} />
          <div className="px-5 py-4">
            {node ? (
              <div className="space-y-2.5 text-[12px]">
                {[
                  ['节点类型', node.role],
                  ['实体编码', node.entity_type_id || '—'],
                  ['数量', String(node.quantity ?? 1)],
                  ['所属区域', result?.scenario.zones.find((z) => z.id === node.zone)?.name ?? '—'],
                  ['IP 地址', node.ip || '未指定'],
                  ['镜像', node.image || '待映射'],
                  ['原文依据', node.evidence || '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-3 border-b border-dashed border-line pb-2 last:border-0">
                    <span className="text-ink-500">{k}</span>
                    <span className="text-right font-medium text-ink-900">{v}</span>
                  </div>
                ))}
                {node.attributes && <pre className="overflow-auto rounded-lg bg-slate-50 p-3 text-[11px]">{JSON.stringify(node.attributes, null, 2)}</pre>}
                {result?.scenario.links.filter((l) => l.source === node.id || l.target === node.id).map((l) => (
                  <div key={l.id} className="rounded-lg border border-line p-2 text-[11px]">
                    <div>{result.scenario.nodes.find((n) => n.id === l.source)?.name} → {result.scenario.nodes.find((n) => n.id === l.target)?.name}</div>
                    <div className="text-ink-500">{[l.relation_type, l.interface, l.protocol, l.bandwidth].filter(Boolean).join(' · ')}</div>
                    {l.evidence && <div className="mt-1 text-ink-400">{l.evidence}</div>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-[12px] text-ink-400">点击左侧拓扑中的节点</div>
            )}
          </div>
        </Card>
      </div>

      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="保存为场景模板"
        desc="保存后进入模板编辑器。逻辑拓扑须完成资源映射后才能部署。"
        width="max-w-lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>
              取消
            </Button>
            <Button variant="primary" onClick={saveTemplate} icon={<ArrowRight className="h-3.5 w-3.5" />}>
              保存并进入编辑器
            </Button>
          </>
        }
      >
        <Field label="模板名称" required>
          <Input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder={result?.scenario.name} />
        </Field>
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-[12px] text-ink-500">
          将保存 {result?.scenario.zones.length ?? 0} 个区域 / {result?.scenario.nodes.length ?? 0} 个节点 /
          {result?.scenario.links.length ?? 0} 条链路，来源标记为「{result?.generator === 'llm' ? 'LLM 生成' : '规则引擎'}」。
        </div>
      </Modal>
    </div>
  )
}
