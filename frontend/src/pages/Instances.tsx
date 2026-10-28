import { Boxes, CheckCircle2, CircleSlash, Loader2, RefreshCw, Server } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import type { Instance } from '@/lib/types'
import { Badge, Button, Card, Empty, Progress, StatCard, Tabs, toast } from '@/components/ui'
import { shortTime, statusLabel, statusTone } from '@/lib/utils'

const STATUS_TABS = [
  { value: '', label: '全部' },
  { value: 'running', label: '运行中' },
  { value: 'provisioning', label: '部署中' },
  { value: 'destroyed', label: '已销毁' },
]

export default function Instances() {
  const [items, setItems] = useState<Instance[]>([])
  const [tab, setTab] = useState('')
  const [loading, setLoading] = useState(true)

  function load(silent = false) {
    if (!silent) setLoading(true)
    api
      .instances()
      .then((r) => setItems(r.items))
      .catch(() => toast('加载实例失败', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    const t = setInterval(() => load(true), 4000)
    return () => clearInterval(t)
  }, [])

  const filtered = useMemo(() => {
    let list = items
    if (tab) list = list.filter((i) => i.status === tab)
    return list
  }, [items, tab])

  const stats = useMemo(
    () => ({
      running: items.filter((i) => i.status === 'running').length,
      provisioning: items.filter((i) => i.status === 'provisioning').length,
      destroyed: items.filter((i) => i.status === 'destroyed').length,
      nodes: items.filter((i) => i.status === 'running').reduce((s, i) => s + (i.nodes?.length ?? 0), 0),
    }),
    [items],
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="运行中" value={stats.running} suffix="个" tone="ok" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="部署中" value={stats.provisioning} suffix="个" tone="brand" icon={<Loader2 className="h-4 w-4" />} />
        <StatCard label="运行节点" value={stats.nodes} suffix="台" tone="muted" icon={<Server className="h-4 w-4" />} />
        <StatCard label="已销毁" value={stats.destroyed} suffix="个" tone="muted" icon={<CircleSlash className="h-4 w-4" />} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs items={STATUS_TABS} value={tab} onChange={setTab} />
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] text-ink-400">每 4 秒自动刷新</span>
          <Button variant="secondary" size="sm" onClick={() => load()} icon={<RefreshCw className="h-3.5 w-3.5" />}>
            刷新
          </Button>
        </div>
      </div>

      <div className="grid gap-3">
        {filtered.map((i) => (
          <Card key={i.id} hover className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Boxes className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/instances/${i.id}`} className="text-[13.5px] font-semibold text-ink-900 hover:text-brand-600">
                      {i.name}
                    </Link>
                    <Badge className={statusTone(i.status)} dot>
                      {statusLabel[i.status] ?? i.status}
                    </Badge>
                    <Badge className="border-slate-200 bg-slate-50 text-ink-500">{i.business_name}</Badge>
                  </div>
                  <div className="mono-num mt-1 text-[11px] text-ink-400">
                    {i.id} · {i.station} · {i.nodes?.length ?? 0} 节点 · {shortTime(i.created_at)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link to={`/instances/${i.id}`}>
                  <Button variant="secondary" size="sm">
                    查看详情
                  </Button>
                </Link>
              </div>
            </div>
            {i.status === 'provisioning' && (
              <div className="mt-3 rounded-lg border border-brand-100 bg-brand-50/50 px-3 py-2">
                <div className="flex items-center justify-between text-[11.5px]">
                  <span className="flex items-center gap-1.5 text-brand-700">
                    <Loader2 className="h-3 w-3 animate-spin" /> {i.stage}
                  </span>
                  <span className="mono-num text-brand-700">{i.progress}%</span>
                </div>
                <Progress value={i.progress} />
              </div>
            )}
          </Card>
        ))}
        {!loading && filtered.length === 0 && (
          <Card>
            <Empty text="暂无场景实例" icon={<Boxes className="h-6 w-6" />} />
          </Card>
        )}
      </div>
    </div>
  )
}
