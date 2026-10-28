import {
  Activity,
  ArrowRight,
  Boxes,
  Cloud,
  Cpu,
  Disc3,
  Layers,
  Server,
  Sparkles,
  Workflow,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import type { Instance, Template } from '@/lib/types'
import { Badge, Button, Card, StatCard } from '@/components/ui'
import { statusLabel, statusTone } from '@/lib/utils'

const MODULES = [
  {
    to: '/topology',
    icon: Workflow,
    tag: 'INTELLITOPO · CODEGRAPH',
    name: '智能拓扑构建',
    desc: '自然语言描述场景，自动生成 IaC 代码与可视化拓扑，代码与图谱双向同步，内置规则校验。',
    color: '#0072CE',
  },
  {
    to: '/orchestrate',
    icon: Boxes,
    tag: 'HYBRID RESOURCE ORCHESTRATION',
    name: '混合资源编排',
    desc: '围绕九类业务快速落位：统一编排算力、网络与模板资源，一键完成场景实例化。',
    color: '#6D5BD0',
  },
  {
    to: '/resources',
    icon: Disc3,
    tag: 'RESOURCE PACKAGING',
    name: '资源封装',
    desc: '镜像、设备、计算、存储、网络五类资源统一分类与规范化封装，跨靶场可移植。',
    color: '#0E7C86',
  },
  {
    to: '/monitor',
    icon: Activity,
    tag: 'CR-MAS',
    name: '监控调度中心',
    desc: '多靶场节点状态统一观测，智能体生成调度建议并给出影响评估，辅助决策执行。',
    color: '#D98324',
  },
]

const FLOW = [
  { icon: Sparkles, label: '自然语言描述' },
  { icon: Workflow, label: '生成 IaC / 拓扑' },
  { icon: Layers, label: '沉淀场景模板' },
  { icon: Boxes, label: '资源编排实例化' },
  { icon: Server, label: '场景运行' },
  { icon: Activity, label: '监控与调度' },
]

function InterconnectGraphic() {
  const nodes = [
    { x: 92, y: 74, label: '北京', sub: '边缘资源池' },
    { x: 268, y: 46, label: '上海', sub: '区域中心' },
    { x: 212, y: 158, label: '武汉', sub: '教学资源池' },
    { x: 66, y: 186, label: '成都', sub: '备份中心' },
    { x: 306, y: 176, label: '深圳', sub: '总部资源池' },
  ]
  return (
    <div className="relative h-full min-h-[240px] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-[#0B4E8F] p-4">
      <div className="absolute inset-0 opacity-[0.16] grid-bg" />
      <svg viewBox="0 0 380 240" className="relative h-full w-full">
        <defs>
          <radialGradient id="glow">
            <stop offset="0%" stopColor="#7FD3FF" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#7FD3FF" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="200" cy="120" r="110" fill="url(#glow)" />
        {nodes.map((a, i) =>
          nodes.slice(i + 1).map((b, j) => (
            <line
              key={`${i}-${j}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#9ED7FF"
              strokeOpacity="0.32"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          )),
        )}
        {nodes.map((n) => (
          <g key={n.label}>
            <circle cx={n.x} cy={n.y} r="13" fill="#7FD3FF" fillOpacity="0.14" />
            <circle cx={n.x} cy={n.y} r="4.5" fill="#EAF6FF" />
            <circle cx={n.x} cy={n.y} r="4.5" fill="none" stroke="#7FD3FF" strokeOpacity="0.8">
              <animate attributeName="r" values="4.5;12;4.5" dur="3.2s" repeatCount="indefinite" />
              <animate attributeName="stroke-opacity" values="0.8;0;0.8" dur="3.2s" repeatCount="indefinite" />
            </circle>
            <text x={n.x + 10} y={n.y - 1} fill="#EAF6FF" fontSize="9.5" fontWeight="600">
              {n.label}
            </text>
            <text x={n.x + 10} y={n.y + 10} fill="#A8D8F5" fontSize="7.5">
              {n.sub}
            </text>
          </g>
        ))}
      </svg>
      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[10.5px] text-brand-100/90">
        <span>全国靶场互联 · 多形态承载</span>
        <span className="rounded-md bg-white/10 px-2 py-0.5">公有云 / 私有云 / 边缘云</span>
      </div>
    </div>
  )
}

export default function Home() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [instances, setInstances] = useState<Instance[]>([])
  const [stats, setStats] = useState({ running: 0, provisioning: 0, nodes: 0 })

  useEffect(() => {
    api.templates().then((r) => setTemplates(r.items)).catch(() => setTemplates([]))
    api
      .instances()
      .then((r) => {
        setInstances(r.items.slice(0, 4))
        setStats({
          running: r.items.filter((i) => i.status === 'running').length,
          provisioning: r.items.filter((i) => i.status === 'provisioning').length,
          nodes: r.items.reduce((s, i) => s + (i.nodes?.length ?? 0), 0),
        })
      })
      .catch(() => setInstances([]))
  }, [])

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="card relative overflow-hidden p-7">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brand-50" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <Badge className="border-brand-200 bg-brand-50 text-brand-700" dot>
                靶场即服务
              </Badge>
              <span className="text-[11px] text-ink-400">Cyber Range as a Service</span>
            </div>
            <h1 className="mt-3 max-w-[520px] text-[26px] font-semibold leading-[1.32] tracking-tight text-ink-900">
              一句话生成拓扑，
              <br />
              把网络安全靶场做成可调度的服务
            </h1>
            <p className="mt-3 max-w-[560px] text-[13px] leading-6 text-ink-500">
              面向教育、政务、能源、金融、水利等行业的实训与攻防演练需求，用自然语言描述场景即可完成 IaC
              代码生成、拓扑校验、资源编排与实例化，让场景供给从"周级"走向"分钟级"。
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <Link to="/topology">
                <Button variant="primary" size="md" icon={<Zap className="h-3.5 w-3.5" />}>
                  开始构建场景
                </Button>
              </Link>
              <Link to="/orchestrate">
                <Button variant="secondary" size="md" icon={<Boxes className="h-3.5 w-3.5" />}>
                  场景实例化
                </Button>
              </Link>
              <span className="ml-1 text-[11.5px] text-ink-400">近 500 个镜像资源 · 3 个资源池在线</span>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-2">
              {FLOW.map((f, i) => {
                const Icon = f.icon
                return (
                  <div key={f.label} className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-2 py-1.5">
                      <Icon className="h-3.5 w-3.5 text-brand-500" />
                      <span className="text-[11.5px] text-ink-700">{f.label}</span>
                    </div>
                    {i < FLOW.length - 1 && <ArrowRight className="h-3 w-3 text-ink-400" />}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <InterconnectGraphic />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="场景模板" value={templates.length} suffix="个" icon={<Layers className="h-4 w-4" />} tone="brand" />
        <StatCard label="运行中实例" value={stats.running} suffix="个" icon={<Server className="h-4 w-4" />} tone="ok" />
        <StatCard label="纳管节点" value={stats.nodes} suffix="台" icon={<Cpu className="h-4 w-4" />} tone="muted" />
        <StatCard label="部署中" value={stats.provisioning} suffix="个" icon={<Cloud className="h-4 w-4" />} tone="warn" />
      </div>

      <div>
        <div className="mb-3">
          <h2 className="text-[17px] font-semibold tracking-tight text-ink-900">四大能力模块</h2>
          <p className="mt-1 text-[12.5px] text-ink-500">从场景描述到靶场运行，全链路闭环</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {MODULES.map((m) => {
            const Icon = m.icon
            return (
              <Link key={m.to} to={m.to}>
                <Card hover className="h-full p-4">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg border"
                    style={{ background: `${m.color}10`, borderColor: `${m.color}26`, color: m.color }}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </div>
                  <div className="mt-3 text-[10px] font-medium uppercase tracking-[0.1em] text-ink-400">{m.tag}</div>
                  <div className="mt-0.5 text-[14px] font-semibold text-ink-900">{m.name}</div>
                  <p className="mt-1.5 text-[12px] leading-5 text-ink-500">{m.desc}</p>
                  <div className="mt-3 flex items-center gap-1 text-[11.5px] font-medium text-brand-600">
                    进入模块 <ArrowRight className="h-3 w-3" />
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <div className="text-[13.5px] font-semibold text-ink-900">最近场景模板</div>
            <Link to="/templates" className="flex items-center gap-1 text-[11.5px] text-brand-600 hover:underline">
              全部模板 <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-line">
            {templates.slice(0, 5).map((t) => (
              <Link
                key={t.id}
                to={`/templates/${t.id}`}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50/70"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-[11px] font-semibold text-brand-600">
                  {t.zone_count}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-medium text-ink-900">{t.name}</div>
                  <div className="mt-0.5 truncate text-[11px] text-ink-400">
                    {t.business_name} · {t.node_count} 节点 · {t.description.slice(0, 36)}
                  </div>
                </div>
                <Badge className="border-slate-200 bg-slate-50 text-ink-500">
                  {t.source === 'llm' ? 'LLM 生成' : '规则引擎'}
                </Badge>
              </Link>
            ))}
            {templates.length === 0 && <div className="px-5 py-10 text-center text-[12px] text-ink-400">暂无模板</div>}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <div className="text-[13.5px] font-semibold text-ink-900">实例运行状态</div>
            <Link to="/instances" className="flex items-center gap-1 text-[11.5px] text-brand-600 hover:underline">
              全部实例 <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-line">
            {instances.map((i) => (
              <Link
                key={i.id}
                to={`/instances/${i.id}`}
                className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-slate-50/70"
              >
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] font-medium text-ink-900">{i.name}</div>
                  <div className="mt-0.5 text-[11px] text-ink-400">
                    {i.station} · {i.nodes?.length ?? 0} 节点
                  </div>
                </div>
                <Badge className={statusTone(i.status)} dot>
                  {statusLabel[i.status] ?? i.status}
                </Badge>
              </Link>
            ))}
            {instances.length === 0 && <div className="px-5 py-10 text-center text-[12px] text-ink-400">暂无实例</div>}
          </div>
        </Card>
      </div>
    </div>
  )
}
