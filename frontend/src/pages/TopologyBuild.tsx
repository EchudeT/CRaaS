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
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Meta } from '@/lib/api'
import type { GenerateResult } from '@/lib/types'
import { CodeView } from '@/components/CodeView'
import { TopologyCanvas } from '@/components/TopologyCanvas'
import { Badge, Button, Card, CardHeader, Field, Input, Modal, Select, Textarea, Tabs, toast } from '@/components/ui'
import { cn } from '@/lib/utils'

const STEPS = ['解析自然语言意图', '抽取区域与网段', '生成 IaC 描述代码', '渲染可视化拓扑']

export default function TopologyBuild() {
  const nav = useNavigate()
  const [meta, setMeta] = useState<Meta | null>(null)
  const [desc, setDesc] = useState(
    '创建一个办公环境，包含办公区、服务器区、运维区三个子网，核心路由器通过边界防火墙接入互联网；办公区部署6台办公电脑，服务器区部署2台服务器，运维区部署2台运维终端。',
  )
  const [industry, setIndustry] = useState('general')
  const [business, setBusiness] = useState('drill')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(0)
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [tab, setTab] = useState('topo')
  const [selected, setSelected] = useState<string | null>(null)
  const [presets, setPresets] = useState<{ name: string; description: string }[]>([])
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')

  useEffect(() => {
    api.meta().then(setMeta).catch(() => setMeta(null))
    api
      .presets()
      .then((r) => setPresets(r.items.map((i) => ({ name: i.name, description: i.description }))))
      .catch(() => setPresets([]))
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
    setStep(0)
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 520)
    try {
      const r = await api.generate({ description: desc, industry, business })
      setResult(r)
      setTab('topo')
      setSelected(null)
      toast(`已生成 ${r.scenario.nodes.length} 个节点 / ${r.scenario.zones.length} 个区域（${r.generator === 'llm' ? 'LLM' : '规则引擎'}）`)
    } catch (e) {
      toast('生成失败，请检查后端服务', 'error')
    } finally {
      clearInterval(timer)
      setLoading(false)
      setStep(STEPS.length - 1)
    }
  }

  async function saveTemplate() {
    if (!result) return
    try {
      const t = await api.createTemplate({
        name: saveName || result.scenario.name,
        description: desc,
        industry,
        business,
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
            desc="用自然语言描述区域划分、节点数量与 IP 分配，系统自动生成 IaC 代码"
            icon={<Wand2 className="h-4 w-4" />}
            right={
              <Badge className={meta?.llm.ready ? 'border-ok/25 bg-ok/10 text-ok' : 'border-slate-200 bg-slate-50 text-ink-500'} dot>
                {meta?.llm.ready ? `LLM · ${meta.llm.model}` : '规则引擎'}
              </Badge>
            }
          />
          <div className="flex flex-1 flex-col gap-3 px-5 py-4">
            <Textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={9}
              placeholder="例如：创建一个办公环境，包含办公区、服务器区、运维区三个子网，核心路由器通过边界防火墙接入互联网；办公区部署 6 台办公电脑…"
              className="resize-none"
            />
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
                {presets.slice(0, 4).map((p) => (
                  <button
                    key={p.name}
                    onClick={() => setDesc(p.description)}
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
              <div className="rounded-lg border border-brand-100 bg-brand-50/60 px-3 py-2.5">
                {STEPS.map((s, i) => (
                  <div key={s} className="flex items-center gap-2 py-0.5 text-[11.5px]">
                    {i < step ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-ok" />
                    ) : i === step ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-500" />
                    ) : (
                      <span className="h-3.5 w-3.5 rounded-full border border-line" />
                    )}
                    <span className={cn(i <= step ? 'text-ink-700' : 'text-ink-400')}>{s}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* 右：结果 */}
        <Card className="flex min-w-0 flex-col">
          <CardHeader
            title="生成结果"
            desc={result ? `${result.scenario.zones.length} 个区域 · ${result.scenario.nodes.length} 个节点 · ${result.scenario.links.length} 条链路` : '生成后可查看代码与拓扑'}
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
                <div className="text-[11px]">支持区域划分、节点数量、IP 网段、安全设备等描述</div>
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
            desc="基于区域网段、IP 唯一性、连通性与端口容量的规则校验"
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
                  未发现冲突：网段无重叠、IP 无重复、无孤岛节点，可直接保存为模板。
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
                  ['所属区域', result?.scenario.zones.find((z) => z.id === node.zone)?.name ?? '—'],
                  ['IP 地址', node.ip],
                  ['镜像', node.image],
                  ['规格', `${node.flavor} · ${node.cpu}C / ${(node.memory / 1024).toFixed(0)}G`],
                  ['磁盘', `${node.disk} GB`],
                  ['端口数', String(node.ports)],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-3 border-b border-dashed border-line pb-2 last:border-0">
                    <span className="text-ink-500">{k}</span>
                    <span className="text-right font-medium text-ink-900">{v}</span>
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
        desc="保存后可进入模板编辑器继续调整，或直接用于实例化部署"
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
