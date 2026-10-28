import {
  AlertTriangle,
  Boxes,
  Check,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Loader2,
  Rocket,
  Server,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, type Meta } from '@/lib/api'
import type { Preview, Template } from '@/lib/types'
import { nodeMeta } from '@/components/nodeMeta'
import { TopologyCanvas } from '@/components/TopologyCanvas'
import { Badge, Button, Card, Field, Select, StatCard, toast } from '@/components/ui'
import { cn, gb, money } from '@/lib/utils'

const SECTIONS = [
  { n: 1, title: '业务与场景模板', desc: '确认业务类型与场景模板' },
  { n: 2, title: '部署参数', desc: '资源池、部署模式与规格档位' },
  { n: 3, title: '资源匹配推荐', desc: '镜像匹配与规格推荐' },
  { n: 4, title: '资源拓扑与 Workload', desc: '编排可视化与工作负载清单' },
  { n: 5, title: '校验与提交', desc: '部署前校验与指令下发' },
]

export default function DeployConsole() {
  const { templateId = '' } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()

  const [meta, setMeta] = useState<Meta | null>(null)
  const [template, setTemplate] = useState<Template | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [business, setBusiness] = useState(params.get('business') || 'drill')
  const [station, setStation] = useState('深圳（总部）资源池')
  const [profile, setProfile] = useState('training_education')
  const [deploying, setDeploying] = useState(false)
  const [name, setName] = useState('')

  useEffect(() => {
    api.meta().then((m) => {
      setMeta(m)
      setStation((s) => s || m.stations[0]?.name)
    })
    api.template(templateId).then((t) => {
      setTemplate(t)
      setBusiness(params.get('business') || t.business)
      setName(`${t.name}-${new Date().toISOString().slice(5, 10).replace('-', '')}`)
    })
  }, [templateId, params])

  useEffect(() => {
    if (!template) return
    api
      .preview({ template_id: template.id, business, station, profile })
      .then(setPreview)
      .catch(() => toast('资源匹配失败', 'error'))
  }, [template, business, station, profile])

  const checks = preview?.checks ?? []
  const passCount = checks.filter((c) => c.status === 'pass').length

  const deployScenario = useMemo(() => {
    if (!template) return null
    const ids = new Set((preview?.workload ?? []).map((w) => w.id))
    if (!ids.size) return null
    return {
      ...template.topology,
      nodes: template.topology.nodes
        .filter((n) => ids.has(n.id))
        .map((n) => ({ ...n, x: undefined, y: undefined })),
      links: template.topology.links.filter((l) => ids.has(l.source) && ids.has(l.target)),
    }
  }, [template, preview])

  const zoneSummary = useMemo(() => {
    if (!template || !deployScenario) return []
    return template.topology.zones
      .map((z) => ({ ...z, count: deployScenario.nodes.filter((n) => n.zone === z.id).length }))
      .filter((z) => z.count > 0)
  }, [template, deployScenario])

  const advice = useMemo(() => {
    if (!preview) return ''
    const heavy = preview.estimate.cpu > 40
    return [
      `场景共 ${preview.workload.length} 个节点，预估占用 ${preview.estimate.cpu} vCPU / ${preview.estimate.memory_gb} GB 内存。`,
      heavy
        ? '资源需求较高，建议选择「竞赛模式」档位并优先调度至总部资源池，避免与教学任务争抢。'
        : '资源需求适中，教学实训档位即可满足，建议调度至就近资源池以降低时延。',
      `镜像匹配：${
        preview.workload.filter((w) => w.image_ready).length
      }/${preview.workload.length} 已命中资源池，缺失镜像将自动从总部镜像仓同步。`,
    ].join(' ')
  }, [preview])

  async function deploy() {
    if (!template) return
    setDeploying(true)
    try {
      const inst = await api.deploy({ template_id: template.id, name, business, station, profile })
      toast('部署指令已下发，正在实例化…')
      nav(`/instances/${inst.id}`)
    } catch {
      toast('部署失败', 'error')
      setDeploying(false)
    }
  }

  if (!template) return <div className="py-20 text-center text-[12.5px] text-ink-400">加载中…</div>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Boxes className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold text-ink-900">HRO 场景实例化控制台</span>
              <Badge className="border-brand-100 bg-brand-50 text-brand-600">
                {meta?.business.find((b) => b.id === business)?.name ?? template.business_name}
              </Badge>
            </div>
            <div className="text-[11.5px] text-ink-400">
              {template.name} · {template.node_count} 节点 / {template.zone_count} 区域
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11.5px] text-ink-500">
          {SECTIONS.map((s, i) => (
            <div key={s.n} className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-[10px] font-semibold text-brand-600">
                {i + 1}
              </span>
              <span className="hidden lg:inline">{s.title}</span>
              {i < SECTIONS.length - 1 && <ChevronRight className="h-3 w-3 text-ink-300" />}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {/* 1 */}
          <Card>
            <div className="border-b border-line px-5 py-3.5">
              <div className="text-[13.5px] font-semibold text-ink-900">1. 业务与场景模板</div>
              <div className="mt-0.5 text-[11.5px] text-ink-500">按业务类型校验模板是否满足场景要求</div>
            </div>
            <div className="grid gap-3 px-5 py-4 md:grid-cols-2">
              <Field label="业务类型">
                <Select
                  value={business}
                  onChange={setBusiness}
                  options={(meta?.business ?? []).map((b) => ({ value: b.id, label: b.name }))}
                />
              </Field>
              <Field label="场景模板">
                <div className="flex h-9 items-center gap-2 rounded-lg border border-line bg-slate-50 px-3 text-[12.5px] text-ink-700">
                  <Check className="h-3.5 w-3.5 text-ok" />
                  {template.name}
                </div>
              </Field>
            </div>
          </Card>

          {/* 2 */}
          <Card>
            <div className="border-b border-line px-5 py-3.5">
              <div className="text-[13.5px] font-semibold text-ink-900">2. 部署参数</div>
              <div className="mt-0.5 text-[11.5px] text-ink-500">选择资源池与规格档位，系统据此生成调度方案</div>
            </div>
            <div className="grid gap-3 px-5 py-4 md:grid-cols-3">
              <Field label="资源池">
                <Select
                  value={station}
                  onChange={setStation}
                  options={(meta?.stations ?? []).map((s) => ({ value: s.name, label: s.name }))}
                />
              </Field>
              <Field label="部署模式">
                <Select
                  value={profile}
                  onChange={setProfile}
                  options={(meta?.profiles ?? []).map((p) => ({ value: p.id, label: p.name }))}
                />
              </Field>
              <Field label="实例名称">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 w-full rounded-lg border border-line px-3 text-[12.5px] outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
              </Field>
            </div>
            <div className="mx-5 mb-4 flex items-start gap-2 rounded-lg border border-brand-100 bg-brand-50/60 px-3 py-2.5">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
              <div>
                <div className="text-[11.5px] font-medium text-brand-700">智能部署建议</div>
                <div className="mt-0.5 text-[11.5px] leading-5 text-ink-600">{advice}</div>
              </div>
            </div>
          </Card>

          {/* 3 */}
          <Card>
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <div>
                <div className="text-[13.5px] font-semibold text-ink-900">3. 资源匹配推荐</div>
                <div className="mt-0.5 text-[11.5px] text-ink-500">在资源池中匹配镜像与规格，逐节点确认匹配结果</div>
              </div>
              <Badge className="border-ok/25 bg-ok/10 text-ok" dot>
                {preview?.workload.length ?? 0} 个工作负载
              </Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-[12px]">
                <thead>
                  <tr className="border-b border-line bg-slate-50/70 text-left text-[11px] text-ink-500">
                    <th className="px-4 py-2 font-medium">工作负载</th>
                    <th className="px-4 py-2 font-medium">类型</th>
                    <th className="px-4 py-2 font-medium">镜像</th>
                    <th className="px-4 py-2 font-medium">规格</th>
                    <th className="px-4 py-2 font-medium">IP</th>
                    <th className="px-4 py-2 font-medium">匹配</th>
                  </tr>
                </thead>
                <tbody>
                  {(preview?.workload ?? []).map((w) => {
                    const m = nodeMeta[w.type] ?? nodeMeta.server
                    const Icon = m.icon
                    return (
                      <tr key={w.id} className="border-b border-line/70 last:border-0 hover:bg-slate-50/50">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5" style={{ color: m.color }} />
                            <span className="text-ink-900">{w.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-ink-500">{m.label}</td>
                        <td className="mono-num px-4 py-2 text-[11px] text-ink-600">{w.image}</td>
                        <td className="mono-num px-4 py-2 text-ink-600">
                          {w.cpu}C / {gb(w.memory)} / {w.disk}G
                        </td>
                        <td className="mono-num px-4 py-2 text-ink-600">{w.ip}</td>
                        <td className="px-4 py-2">
                          <Badge className="border-ok/25 bg-ok/10 text-ok" dot>
                            已匹配
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* 4 */}
          <Card>
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <div>
                <div className="text-[13.5px] font-semibold text-ink-900">4. 资源拓扑与 Workload</div>
                <div className="mt-0.5 text-[11.5px] text-ink-500">按资源池匹配结果生成的部署拓扑，节点与模板一致</div>
              </div>
              <Badge className="border-brand-100 bg-brand-50 text-brand-600">{zoneSummary.length} 个区域</Badge>
            </div>
            <div className="px-4 py-3.5">
              {deployScenario ? (
                <>
                  <TopologyCanvas scenario={deployScenario} height={320} />
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {zoneSummary.map((z) => (
                      <span
                        key={z.id}
                        className="flex items-center gap-1.5 rounded-md border border-line bg-white px-2 py-1 text-[11px] text-ink-600"
                      >
                        <span className="h-2 w-2 rounded-sm" style={{ background: z.color }} />
                        {z.name}
                        <span className="mono-num text-[10px] text-ink-400">{z.count} 节点</span>
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="py-10 text-center text-[12px] text-ink-400">正在生成部署拓扑…</div>
              )}
            </div>
          </Card>

          {/* 5 */}
          <Card>
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <div>
                <div className="text-[13.5px] font-semibold text-ink-900">5. 校验与提交</div>
                <div className="mt-0.5 text-[11.5px] text-ink-500">部署前校验通过后方可下发实例化指令</div>
              </div>
              <Badge className={passCount === checks.length ? 'border-ok/25 bg-ok/10 text-ok' : 'border-warn/25 bg-warn/10 text-warn'} dot>
                {passCount}/{checks.length} 通过
              </Badge>
            </div>
            <div className="grid gap-2 px-5 py-4 md:grid-cols-2">
              {checks.map((c) => (
                <div
                  key={c.name}
                  className={cn(
                    'flex items-start gap-2 rounded-lg border px-3 py-2',
                    c.status === 'pass' ? 'border-line bg-white' : 'border-warn/25 bg-warn/5',
                  )}
                >
                  {c.status === 'pass' ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
                  )}
                  <div>
                    <div className="text-[12px] font-medium text-ink-900">{c.name}</div>
                    <div className="text-[11px] text-ink-500">{c.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* 右侧汇总 */}
        <div className="space-y-3">
          <div className="sticky top-0 space-y-3">
            <Card className="p-4">
              <div className="text-[13px] font-semibold text-ink-900">部署预估</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <StatCard label="vCPU" value={preview?.estimate.cpu ?? 0} suffix="核" icon={<Cpu className="h-4 w-4" />} />
                <StatCard label="内存" value={preview?.estimate.memory_gb ?? 0} suffix="GB" icon={<Server className="h-4 w-4" />} />
              </div>
              <div className="mt-2 space-y-1.5 rounded-lg bg-slate-50 px-3 py-2.5 text-[11.5px]">
                <div className="flex justify-between">
                  <span className="text-ink-500">磁盘</span>
                  <span className="mono-num text-ink-900">{preview?.estimate.disk_gb ?? 0} GB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-500">预估成本</span>
                  <span className="mono-num text-ink-900">{money(preview?.estimate.cost_per_hour ?? 0)} / 小时</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-500">预计耗时</span>
                  <span className="mono-num text-ink-900">{preview?.estimate.eta_seconds ?? 0} 秒</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-500">资源池</span>
                  <span className="text-ink-900">{station}</span>
                </div>
              </div>
              <Button
                variant="primary"
                size="lg"
                className="mt-3 w-full"
                onClick={deploy}
                disabled={deploying || checks.some((c) => c.status === 'fail')}
                icon={deploying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              >
                {deploying ? '正在下发指令…' : '提交部署'}
              </Button>
              <div className="mt-2 text-center text-[10.5px] text-ink-400">
                演示环境使用模拟执行器，约 7 秒完成实例化
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-[12.5px] font-semibold text-ink-900">模板结构</div>
              <div className="mt-2 space-y-1.5">
                {(template.topology?.zones ?? []).map((z) => (
                  <div key={z.id} className="flex items-center justify-between text-[11.5px]">
                    <span className="flex items-center gap-1.5 text-ink-600">
                      <span className="h-2 w-2 rounded-sm" style={{ background: z.color }} />
                      {z.name}
                    </span>
                    <span className="mono-num text-ink-400">{z.cidr}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
