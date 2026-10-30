import { Activity, Boxes, Cpu, Gauge, RefreshCw, Server, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '@/lib/api'
import type { MonitorOverview } from '@/lib/types'
import { Badge, Button, Card, CardHeader, Modal, Progress, StatCard, toast } from '@/components/ui'
import { cn, money } from '@/lib/utils'
import { DataBadge, SceneBar, metricSource, sceneUrl, useScene, useRequestGuard } from '@/components/SceneContext'

type History = { t: string; cpu: number; memory: number; network: number }

function MetricBar({
  label,
  value,
  tone = 'brand',
}: {
  label: string
  value: number
  tone?: 'brand' | 'ok' | 'warn' | 'danger' | 'muted'
}) {
  const t = value > 85 ? 'danger' : value > 70 ? 'warn' : tone
  return (
    <div>
      <div className="flex items-center justify-between text-[10.5px]">
        <span className="text-ink-400">{label}</span>
        <span className="mono-num text-ink-700">{Math.round(value)}%</span>
      </div>
      <div className="mt-1">
        <Progress value={value} tone={t} height="h-1" />
      </div>
    </div>
  )
}

export default function Monitor() {
  const [scene, setScene] = useScene()
  const [data, setData] = useState<MonitorOverview | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [history, setHistory] = useState<History[]>([])
  const [historySource, setHistorySource] = useState('')
  const beginRequest = useRequestGuard(scene)

  function load() {
    const current = beginRequest()
    api.monitor(scene).then((r) => { if (current()) setData(r) }).catch(() => { if (current()) { setData(null); toast('加载监控数据失败', 'error') } })
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [scene])

  useEffect(() => {
    if (!selected) return
    let active = true
    setHistory([])
    setHistorySource('')
    api.nodeHistory(selected).then((r) => { if (active) { setHistory(r.points); setHistorySource(r.source) } }).catch(() => { if (active) setHistory([]) })
    return () => { active = false }
  }, [selected])

  const node = data?.nodes.find((n) => n.id === selected)

  return (
    <div className="space-y-4">
      <SceneBar scene={scene} onChange={(s) => { setSelected(null); setData(null); setScene(s) }} />
      <Card className="space-y-2 p-3 text-xs text-ink-500">
        <p>指标按场景关联的计算节点聚合；演示指标仅用于展示，实时采集与采集失败后的模拟指标分别标注。实例为场景关联，未表示已分配到某一计算节点。</p>
        <div className="flex flex-wrap items-center gap-3"><span>关联实例：</span>{data?.instances?.map((i) => <Link key={i.id} to={`/instances/${i.id}`} className="flex items-center gap-1 text-brand-600">{i.name}<DataBadge demo={i.is_demo} /></Link>)}</div>
        {!data?.nodes.length && <p>当前场景暂无关联监控节点。</p>}
      </Card>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="资源池" value={data?.summary.pool_count ?? 0} suffix="个" icon={<Boxes className="h-4 w-4" />} />
        <StatCard label="纳管节点" value={data?.summary.node_count ?? 0} suffix="台" tone="muted" icon={<Server className="h-4 w-4" />} />
        <StatCard label="关联实例（含演示）" value={data?.summary.instance_count ?? 0} suffix="个" tone="ok" icon={<Activity className="h-4 w-4" />} />
        <StatCard label="平均 CPU" value={data?.summary.cpu_avg ?? 0} suffix="%" tone="brand" icon={<Gauge className="h-4 w-4" />} />
        <StatCard label="每小时成本" value={money(data?.summary.cost_per_hour ?? 0)} tone="muted" icon={<Wallet className="h-4 w-4" />} />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13.5px] font-semibold text-ink-900">资源监控中心</div>
          <div className="mt-0.5 text-[11.5px] text-ink-500">每 5 秒刷新一次，指标来源见各节点及历史图标记</div>
        </div>
        <Button variant="secondary" size="sm" onClick={load} icon={<RefreshCw className="h-3.5 w-3.5" />}>
          刷新
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader title="靶场资源" desc="按资源池聚合的算力与网络水位" icon={<Boxes className="h-4 w-4" />} />
          <div className="divide-y divide-line">
            {(data?.pools ?? []).map((p) => (
              <div key={p.name} className="px-5 py-3.5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[12.5px] font-semibold text-ink-900">{p.name}</span>
                      <Badge className="border-ok/25 bg-ok/10 text-ok" dot>
                        {data?.nodes.filter((n) => n.site === p.name).every((n) => n.is_demo) ? '演示资源池' : '资源池'}
                      </Badge>
                    </div>
                    <div className="mt-0.5 text-[11px] text-ink-400">
                      {p.region} · {p.node_count} 节点 · 时延 {p.latency}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="mono-num text-[13px] font-semibold text-ink-900">{money(p.cost_per_hour)}</div>
                    <div className="text-[10px] text-ink-400">每小时</div>
                  </div>
                </div>
                <div className="mt-2.5 grid grid-cols-4 gap-3">
                  <MetricBar label="CPU" value={p.cpu} />
                  <MetricBar label="内存" value={p.memory} />
                  <MetricBar label="存储" value={p.storage} tone="muted" />
                  <MetricBar label="网络" value={p.network} />
                </div>
                <div className="mt-2 flex items-center justify-between text-[10.5px] text-ink-400">
                  <span>带宽 {p.bandwidth} Mbps</span>
                  <button
                    onClick={() => {
                      const first = data?.nodes.find((n) => n.site === p.name)
                      if (first) setSelected(first.id)
                    }}
                    className="cursor-pointer text-brand-600 transition-colors hover:text-brand-700"
                  >
                    进入节点监控 →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="节点资源" desc="单节点 CPU / 内存 / 存储 / 网络占用" icon={<Server className="h-4 w-4" />} />
          <div className="grid gap-2.5 px-4 py-4 sm:grid-cols-2">
            {(data?.nodes ?? []).map((n) => (
              <button
                key={n.id}
                onClick={() => setSelected(n.id)}
                className="cursor-pointer rounded-xl border border-line bg-white px-3 py-2.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card"
              >
                <div className="flex items-center justify-between">
                  <span className="mono-num text-[12px] font-semibold text-ink-900">{n.name}</span>
                  <span className="flex items-center gap-1 text-[10px] text-ok">
                    {metricSource(n.metrics.source)}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[10px] text-ink-400">
                  {n.site} · {n.cpu_cores} 核 · {n.gpu ? n.gpu : '无 GPU'}
                </div>
                <div className="mt-1 text-[10px] text-brand-600">{n.scene_names?.join(' · ') || '场景未关联'} {n.is_demo ? '· 演示数据' : ''}</div>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  <MetricBar label="CPU" value={n.metrics.cpu} />
                  <MetricBar label="内存" value={n.metrics.memory} />
                  <MetricBar label="存储" value={n.metrics.storage} tone="muted" />
                  <MetricBar label="网络" value={n.metrics.network} />
                </div>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`节点监控 · ${node?.name ?? ''}`}
        desc={`${node?.site ?? ''} · ${node?.ip ?? ''} · ${node?.cpu_cores ?? 0} 核`}
        width="max-w-3xl"
      >
        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-ink-500"><span>当前：{metricSource(node?.metrics.source)} · 历史：{metricSource(historySource)}</span><Link className="text-brand-600" to={sceneUrl('/resources/compute', scene)}>查看关联计算资源</Link></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['CPU', node?.metrics.cpu ?? 0],
            ['内存', node?.metrics.memory ?? 0],
            ['存储', node?.metrics.storage ?? 0],
            ['网络', node?.metrics.network ?? 0],
          ].map(([k, v]) => (
            <div key={k as string} className="rounded-lg border border-line px-3 py-2">
              <div className="text-[10.5px] text-ink-400">{k}</div>
              <div className="mono-num text-[16px] font-semibold text-ink-900">{Math.round(v as number)}%</div>
            </div>
          ))}
        </div>
        <div className="mt-4 h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="gCpu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0072CE" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#0072CE" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gMem" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6D5BD0" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#6D5BD0" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
              <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#8494A8' }} interval={3} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#8494A8' }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E3E9F0' }} />
              <Area type="monotone" dataKey="cpu" name="CPU" stroke="#0072CE" strokeWidth={1.6} fill="url(#gCpu)" />
              <Area type="monotone" dataKey="memory" name="内存" stroke="#6D5BD0" strokeWidth={1.6} fill="url(#gMem)" />
              <Area type="monotone" dataKey="network" name="网络" stroke="#0E7C86" strokeWidth={1.4} fillOpacity={0} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className={cn('mt-1 flex items-center gap-4 text-[10.5px] text-ink-400')}>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-3 rounded bg-brand-500" /> CPU
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-3 rounded bg-[#6D5BD0]" /> 内存
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-3 rounded bg-[#0E7C86]" /> 网络
          </span>
        </div>
      </Modal>
    </div>
  )
}
