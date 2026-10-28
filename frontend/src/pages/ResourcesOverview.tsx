import { ArrowRight, Boxes, CheckCircle2, Cpu, Database, Disc3, Layers, Network, Server } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { Badge, Card, CardHeader, StatCard } from '@/components/ui'

const ICONS: Record<string, typeof Boxes> = {
  image: Disc3,
  device: Server,
  compute: Cpu,
  storage: Database,
  network: Network,
}

const LINKS: Record<string, string> = {
  image: '/resources/images',
  compute: '/resources/compute',
  storage: '/resources/storage',
  network: '/resources/network',
  device: '/resources/compute',
}

const PRINCIPLES = [
  { title: '封装字段分层清晰', desc: '按基础属性、规格容量、计价信息、系统配置四层描述，字段含义统一。' },
  { title: '资源录入流程规范', desc: '标准化表单 + 校验规则，避免同一资源在不同靶场出现描述歧义。' },
  { title: '列表与详情统一展示', desc: '统一的开源口径，资源可在多个靶场之间移植与复用。' },
]

export default function ResourcesOverview() {
  const [data, setData] = useState<{ cards: any[]; industry_extra: { name: string; count: number }[] } | null>(null)

  useEffect(() => {
    api.resourceOverview().then(setData).catch(() => setData(null))
  }, [])

  return (
    <div className="space-y-4">
      <Card className="relative overflow-hidden p-6">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-50" />
        <div className="relative max-w-[720px]">
          <Badge className="border-brand-200 bg-brand-50 text-brand-700" dot>
            资源封装
          </Badge>
          <h2 className="mt-2.5 text-[20px] font-semibold tracking-tight text-ink-900">
            资源分类，规范化封装描述
          </h2>
          <p className="mt-2 text-[12.5px] leading-6 text-ink-500">
            将靶场内可编排的资源统一建模为镜像、设备、计算、存储、网络五类，按统一字段规范封装，
            解决不同靶场、不同行业在资源描述与封装方面的异构问题。
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="rounded-lg border border-line bg-white/80 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-ink-900">
                  <CheckCircle2 className="h-3.5 w-3.5 text-ok" />
                  {p.title}
                </div>
                <div className="mt-1 text-[11px] leading-4 text-ink-500">{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {(data?.cards ?? []).map((c) => {
          const Icon = ICONS[c.id] ?? Boxes
          return (
            <Link key={c.id} to={LINKS[c.id] ?? '/resources'}>
              <Card hover className="h-full p-4">
                <div className="flex items-center justify-between">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <Icon className="h-4 w-4" />
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-ink-300" />
                </div>
                <div className="mono-num mt-2.5 text-[20px] font-semibold leading-6 text-ink-900">
                  {c.count}
                  <span className="ml-1 text-[11px] font-normal text-ink-400">{c.unit}</span>
                </div>
                <div className="text-[12.5px] font-medium text-ink-900">{c.name}</div>
                <div className="mt-0.5 text-[10.5px] leading-4 text-ink-400">{c.desc}</div>
              </Card>
            </Link>
          )
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="行业特有资源" desc="面向行业场景沉淀的专用镜像与设备" icon={<Layers className="h-4 w-4" />} />
          <div className="divide-y divide-line">
            {(data?.industry_extra ?? []).map((i) => (
              <div key={i.name} className="flex items-center justify-between px-5 py-3">
                <span className="text-[12.5px] text-ink-700">{i.name}</span>
                <span className="mono-num text-[13px] font-semibold text-ink-900">{i.count}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="资源池概览" desc="三个资源池统一纳管，支持跨池调度" icon={<Cpu className="h-4 w-4" />} />
          <div className="grid gap-3 px-5 py-4 sm:grid-cols-3">
            <StatCard label="深圳（总部）" value="6" suffix="节点" tone="brand" />
            <StatCard label="北京（边缘）" value="1" suffix="节点" tone="muted" />
            <StatCard label="武汉（教学）" value="2" suffix="节点" tone="muted" />
          </div>
        </Card>
      </div>
    </div>
  )
}
