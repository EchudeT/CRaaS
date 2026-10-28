import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Lightbulb,
  RefreshCw,
  Rocket,
  ShieldAlert,
  Sparkles,
  XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import type { DispatchEvent } from '@/lib/types'
import { Badge, Button, Card, CardHeader, Empty, Modal, Progress, StatCard, toast } from '@/components/ui'
import { cn, levelTone, shortTime } from '@/lib/utils'

const METRIC_LABEL: Record<string, string> = {
  cpu: 'CPU',
  memory: '内存',
  storage: '存储',
  network: '网络',
}

export default function Scheduler() {
  const [items, setItems] = useState<DispatchEvent[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  function load() {
    api
      .events()
      .then((r) => {
        setItems(r.items)
        setSelected((s) => s ?? r.items.find((e) => e.status === 'pending')?.id ?? r.items[0]?.id ?? null)
      })
      .catch(() => toast('加载调度事件失败', 'error'))
  }

  useEffect(() => {
    load()
  }, [])

  const pending = useMemo(() => items.filter((e) => e.status === 'pending'), [items])
  const done = useMemo(() => items.filter((e) => e.status !== 'pending'), [items])
  const event = items.find((e) => e.id === selected) ?? null

  async function act(kind: 'execute' | 'ignore') {
    if (!event) return
    setBusy(true)
    try {
      if (kind === 'execute') await api.executeEvent(event.id)
      else await api.ignoreEvent(event.id)
      toast(kind === 'execute' ? '调度建议已执行' : '已忽略该建议')
      setConfirm(false)
      load()
    } catch {
      toast('操作失败', 'error')
    } finally {
      setBusy(false)
    }
  }

  const metrics = ['cpu', 'memory', 'storage', 'network']

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="待处理事件" value={pending.length} suffix="条" tone="warn" icon={<ShieldAlert className="h-4 w-4" />} />
        <StatCard label="已执行" value={items.filter((e) => e.status === 'executed').length} suffix="条" tone="ok" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="已忽略" value={items.filter((e) => e.status === 'ignored').length} suffix="条" tone="muted" icon={<XCircle className="h-4 w-4" />} />
        <StatCard label="调度策略" value="CR-MAS" suffix="" tone="brand" icon={<Sparkles className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader
            title="待处理调度事件"
            desc="基于资源水位与运行状态，由智能体生成调度建议"
            icon={<ShieldAlert className="h-4 w-4" />}
            right={
              <Button variant="ghost" size="sm" onClick={load} icon={<RefreshCw className="h-3.5 w-3.5" />}>
                刷新
              </Button>
            }
          />
          <div className="space-y-2.5 px-4 py-4">
            {pending.map((e) => (
              <button
                key={e.id}
                onClick={() => setSelected(e.id)}
                className={cn(
                  'w-full cursor-pointer rounded-xl border p-3 text-left transition-all duration-200',
                  selected === e.id
                    ? 'border-brand-400 bg-brand-50/50 shadow-sm'
                    : 'border-line bg-white hover:border-brand-200 hover:shadow-card',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Badge className={levelTone(e.level)}>
                      {e.level === 'critical' ? '严重' : e.level === 'warning' ? '告警' : '提示'}
                    </Badge>
                    <span className="text-[10.5px] text-ink-400">{shortTime(e.created_at)}</span>
                  </div>
                  <Badge className="border-slate-200 bg-slate-50 text-ink-500">{e.action_label}</Badge>
                </div>
                <div className="mt-1.5 text-[12.5px] font-medium text-ink-900">{e.title}</div>
                <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-ink-500">{e.trigger_desc}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-ink-400">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5">实例 {e.instance_name}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5">节点 {e.node_name}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5">指标 {METRIC_LABEL[e.metric] ?? e.metric}</span>
                </div>
              </button>
            ))}
            {pending.length === 0 && <Empty text="当前没有待处理的调度事件" icon={<CheckCircle2 className="h-6 w-6" />} />}
          </div>
        </Card>

        <div className="space-y-3">
          <Card>
            <CardHeader
              title="资源调整影响评估"
              desc="执行前对比节点资源占用变化"
              icon={<Lightbulb className="h-4 w-4" />}
              right={event ? <Badge className={levelTone(event.level)}>{event.action_label}</Badge> : null}
            />
            {event ? (
              <div className="px-5 py-4">
                <div className="rounded-lg border border-brand-100 bg-brand-50/50 px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
                    <div className="text-[11.5px] leading-5 text-ink-700">{event.suggestion}</div>
                  </div>
                </div>

                <div className="mt-3.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[10.5px]">
                  <div className="text-center text-ink-400">当前状态</div>
                  <div />
                  <div className="text-center text-brand-600">执行后预期</div>
                </div>

                <div className="mt-1.5 space-y-2">
                  {metrics.map((m) => (
                    <div key={m} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <div>
                        <Progress value={event.before?.[m] ?? 0} tone={(event.before?.[m] ?? 0) > 80 ? 'danger' : 'muted'} />
                        <div className="mono-num mt-0.5 text-[10px] text-ink-400">
                          {METRIC_LABEL[m]} {event.before?.[m] ?? 0}%
                        </div>
                      </div>
                      <ArrowRight className="h-3 w-3 text-ink-300" />
                      <div>
                        <Progress value={event.after?.[m] ?? 0} tone="brand" />
                        <div className="mono-num mt-0.5 text-[10px] text-brand-600">
                          {METRIC_LABEL[m]} {event.after?.[m] ?? 0}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <Button variant="ghost" size="md" onClick={() => setSelected(null)}>
                    暂不处理
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    disabled={event.status !== 'pending' || busy}
                    onClick={() => act('ignore')}
                    icon={<XCircle className="h-3.5 w-3.5" />}
                  >
                    忽略建议
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    className="ml-auto"
                    disabled={event.status !== 'pending'}
                    onClick={() => setConfirm(true)}
                    icon={<Rocket className="h-3.5 w-3.5" />}
                  >
                    执行建议
                  </Button>
                </div>
                {event.status !== 'pending' && (
                  <div className="mt-2 text-center text-[10.5px] text-ink-400">
                    该事件已{event.status === 'executed' ? '执行' : '忽略'}
                  </div>
                )}
              </div>
            ) : (
              <Empty text="选择左侧事件查看影响评估" icon={<Lightbulb className="h-6 w-6" />} />
            )}
          </Card>

          <Card>
            <CardHeader title="近期处理记录" desc="调度动作的执行历史" icon={<Clock className="h-4 w-4" />} />
            <div className="divide-y divide-line">
              {done.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-[12px] text-ink-900">{e.title}</div>
                    <div className="mt-0.5 text-[10.5px] text-ink-400">{shortTime(e.created_at)}</div>
                  </div>
                  <Badge
                    className={cn(
                      e.status === 'executed' ? 'border-ok/25 bg-ok/10 text-ok' : 'border-slate-200 bg-slate-50 text-ink-400',
                    )}
                  >
                    {e.status === 'executed' ? '已执行' : '已忽略'}
                  </Badge>
                </div>
              ))}
              {done.length === 0 && <div className="px-5 py-8 text-center text-[11.5px] text-ink-400">暂无处理记录</div>}
            </div>
          </Card>
        </div>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <div className="text-[12px] text-ink-500">
          需要查看实例详情或节点访问方式？
          <Link to="/instances" className="ml-1 text-brand-600 hover:underline">
            进入场景实例
          </Link>
        </div>
        <Link to="/monitor">
          <Button variant="secondary" size="sm" icon={<ArrowRight className="h-3.5 w-3.5" />}>
            资源监控中心
          </Button>
        </Link>
      </Card>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="确认执行调度建议？"
        desc={event?.title}
        width="max-w-md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => act('execute')} disabled={busy}>
              OK
            </Button>
          </>
        }
      >
        <div className="text-[12.5px] leading-6 text-ink-600">
          将对实例 <span className="font-medium text-ink-900">{event?.instance_name}</span> 的节点
          <span className="font-medium text-ink-900"> {event?.node_name}</span> 执行「{event?.action_label}」，
          演示环境不会真实变更虚机规格，仅更新实例配置记录与监控水位。
        </div>
      </Modal>
    </div>
  )
}
