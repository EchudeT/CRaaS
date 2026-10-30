import {
  Boxes,
  Clock,
  Copy,
  Loader2,
  MonitorPlay,
  Network,
  RefreshCw,
  Server,
  Trash2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '@/lib/api'
import type { Instance } from '@/lib/types'
import { nodeMeta } from '@/components/nodeMeta'
import { Badge, Button, Card, CardHeader, KeyValue, Modal, Progress, StatCard, toast } from '@/components/ui'
import { cn, copy, gb, shortTime, statusLabel, statusTone } from '@/lib/utils'
import { DataBadge, SceneBar, sceneUrl } from '@/components/SceneContext'

export default function InstanceDetail() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [inst, setInst] = useState<Instance | null>(null)
  const [consoleNode, setConsoleNode] = useState<string | null>(null)

  function load() {
    api
      .instance(id)
      .then(setInst)
      .catch(() => toast('实例加载失败', 'error'))
  }

  useEffect(() => {
    load()
    const t = setInterval(() => {
      api.instance(id).then((r) => {
        setInst(r)
        if (r.status !== 'provisioning') clearInterval(t)
      }).catch(() => {})
    }, 1500)
    return () => clearInterval(t)
  }, [id])

  async function destroy() {
    try {
      await api.destroy(id)
      toast('实例已销毁')
      load()
    } catch {
      toast('销毁失败', 'error')
    }
  }

  if (!inst) return <div className="py-20 text-center text-[12.5px] text-ink-400">加载中…</div>

  const running = inst.nodes.filter((n) => n.status === 'running').length
  const node = inst.nodes.find((n) => n.id === consoleNode)

  return (
    <div className="space-y-4">
      <SceneBar scene={inst.scene || ''} onChange={(s) => nav(sceneUrl('/instances', s))} />
      <Card className="space-y-2 p-3 text-xs">
        <div className="flex items-center gap-2"><DataBadge demo={inst.is_demo} /><span>{inst.scene_name}</span></div>
        {inst.is_demo && <p className="text-ink-500">{inst.status === 'demo' ? '此实例用于展示场景关联，未创建真实资源。离线演示节点无远程访问入口，资源容量及监控指标均为演示。' : '此实例使用模拟环境，状态、访问参数和控制台用于演示，未创建真实平台资源。'}</p>}
        <div className="flex gap-4 text-brand-600"><Link to={`/templates/${inst.template_id}`}>查看来源模板与拓扑</Link><Link to={sceneUrl('/resources', inst.scene || '')}>查看场景资源</Link><Link to={sceneUrl('/monitor', inst.scene || '')}>查看场景监控</Link></div>
      </Card>
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[16px] font-semibold text-ink-900">{inst.name}</span>
                <Badge className={statusTone(inst.status)} dot>
                  {inst.status === 'demo' ? '离线演示' : statusLabel[inst.status] ?? inst.status}
                </Badge>
                <Badge className="border-slate-200 bg-slate-50 text-ink-500">{inst.business_name}</Badge>
              </div>
              <div className="mono-num mt-1 text-[11.5px] text-ink-400">
                {inst.id} · 模板 {inst.template_name} · {inst.station}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={load} icon={<RefreshCw className="h-3.5 w-3.5" />}>
              刷新
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={destroy}
              disabled={inst.status === 'demo' || inst.status === 'destroyed'}
              icon={<Trash2 className="h-3.5 w-3.5" />}
            >
              销毁实例
            </Button>
            <Button variant="primary" size="sm" onClick={() => nav('/instances')}>
              返回列表
            </Button>
          </div>
        </div>

        {inst.status === 'provisioning' && (
          <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-3">
            <div className="flex items-center justify-between text-[12px]">
              <span className="flex items-center gap-1.5 font-medium text-brand-700">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> 正在{inst.stage}
              </span>
              <span className="mono-num text-brand-700">{inst.progress}%</span>
            </div>
            <div className="mt-2">
              <Progress value={inst.progress} />
            </div>
            <div className="mt-1.5 text-[11px] text-ink-500">
              资源申请 → 镜像分发 → 网络编排 → 实例启动 → 就绪
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="节点总数" value={inst.nodes.length} suffix="台" icon={<Server className="h-4 w-4" />} />
        <StatCard label="已启动" value={running} suffix="台" tone="ok" icon={<Server className="h-4 w-4" />} />
        <StatCard label="资源池" value={inst.station.slice(0, 4)} suffix="" tone="muted" icon={<Network className="h-4 w-4" />} />
        <StatCard label="创建时间" value={shortTime(inst.created_at).slice(5)} suffix="" tone="muted" icon={<Clock className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden">
          <CardHeader
            title="节点列表与访问方式"
            desc={inst.status === 'demo' ? '演示节点清单，未部署、未分配登录信息' : inst.is_demo ? '模拟节点清单与演示访问参数' : '实例化完成后即可通过远程控制台访问节点'}
            icon={<Server className="h-4 w-4" />}
            right={
              <Badge className="border-brand-100 bg-brand-50 text-brand-600">
                {inst.profile?.profile?.name ?? '教学实训'}
              </Badge>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-line bg-slate-50/70 text-left text-[11px] text-ink-500">
                  <th className="px-4 py-2 font-medium">节点</th>
                  <th className="px-4 py-2 font-medium">名称</th>
                  <th className="px-4 py-2 font-medium">IP</th>
                  <th className="px-4 py-2 font-medium">端口</th>
                  <th className="px-4 py-2 font-medium">账号 / 密码</th>
                  <th className="px-4 py-2 font-medium">状态</th>
                  <th className="px-4 py-2 text-right font-medium">控制台</th>
                </tr>
              </thead>
              <tbody>
                {inst.nodes.map((n) => {
                  const m = nodeMeta[n.type] ?? nodeMeta.server
                  const Icon = m.icon
                  return (
                    <tr key={n.id} className="border-b border-line/70 last:border-0 hover:bg-slate-50/50">
                      <td className="px-4 py-2">
                        <Icon className="h-3.5 w-3.5" style={{ color: m.color }} />
                      </td>
                      <td className="px-4 py-2 font-medium text-ink-900">{n.name}</td>
                      <td className="mono-num px-4 py-2 text-ink-600">{n.ip}</td>
                      <td className="mono-num px-4 py-2 text-ink-600">{n.ssh_port || '—'}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="mono-num text-ink-600">{n.username}</span>
                          <span className="text-ink-300">/</span>
                          <span className="mono-num text-ink-600">{n.password}</span>
                          <button
                            onClick={() => {
                              copy(`${n.username} / ${n.password}`)
                              toast('账号密码已复制')
                            }}
                            className="cursor-pointer text-ink-300 transition-colors hover:text-brand-500"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <Badge
                          className={cn(
                            n.status === 'running'
                              ? 'border-ok/25 bg-ok/10 text-ok'
                              : n.status === 'stopped'
                                ? 'border-slate-200 bg-slate-50 text-ink-400'
                                : 'border-brand-200 bg-brand-50 text-brand-600',
                          )}
                          dot
                        >
                          {n.status === 'demo' ? '离线演示' : n.status === 'running' ? '运行中' : n.status === 'stopped' ? '已停止' : '启动中'}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => setConsoleNode(n.id)}
                          disabled={n.status !== 'running'}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11.5px] text-brand-600 transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:text-ink-300"
                        >
                          <MonitorPlay className="h-3 w-3" /> 打开控制台
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-3">
          <Card className="p-4">
            <div className="text-[13px] font-semibold text-ink-900">资源详情</div>
            <div className="mt-2">
              <KeyValue
                items={[
                  { k: '实例名称', v: inst.name },
                  { k: '场景模板', v: inst.template_name },
                  { k: '所属资源池', v: inst.station },
                  { k: '业务类型', v: inst.business_name },
                  { k: '部署模式', v: inst.profile?.profile?.name ?? '教学实训' },
                  { k: '节点规模', v: `${inst.nodes.length} 台` },
                  {
                    k: '资源规格',
                    v: `${inst.profile?.estimate?.cpu ?? '—'} 核 / ${inst.profile?.estimate?.memory_gb ?? '—'} GB`,
                  },
                  {
                    k: '预估成本',
                    v: `¥${inst.profile?.estimate?.cost_per_hour ?? '—'} / 小时`,
                  },
                  { k: '创建时间', v: shortTime(inst.created_at) },
                ]}
              />
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-[13px] font-semibold text-ink-900">镜像与规格</div>
            <div className="mt-2 space-y-2">
              {Array.from(new Set(inst.nodes.map((n) => n.image))).slice(0, 6).map((img) => (
                <div key={img} className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                  <span className="mono-num text-[11px] text-ink-700">{img}</span>
                  <Badge className="border-ok/25 bg-ok/10 text-ok">就绪</Badge>
                </div>
              ))}
              <div className="pt-1 text-[11px] text-ink-400">
                合计 CPU {inst.nodes.reduce((s, n) => s + n.cpu, 0)} 核 · 内存{' '}
                {gb(inst.nodes.reduce((s, n) => s + n.memory, 0))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={!!consoleNode}
        onClose={() => setConsoleNode(null)}
        title={`远程控制台 · ${node?.name ?? ''}`}
        desc="演示环境为模拟终端，接入真实靶场后将通过 WebSSH / VNC 直连"
        width="max-w-2xl"
      >
        <div className="rounded-lg bg-[#0B1622] p-4 font-mono text-[12px] leading-6 text-[#9BE7A6]">
          <div className="text-[#7E93A8]">Connecting to {node?.ip}:{node?.ssh_port} as {node?.username} …</div>
          <div>Welcome to CRaaS Target Node ({node?.image})</div>
          <div className="text-[#7E93A8]">Last login: {new Date().toLocaleString('zh-CN')}</div>
          <div className="mt-1">
            [{node?.username}@{node?.name} ~]$ <span className="animate-pulse">▊</span>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-[11.5px]">
          <div className="rounded-lg border border-line px-2.5 py-2">
            <div className="text-ink-400">IP</div>
            <div className="mono-num mt-0.5 text-ink-900">{node?.ip}</div>
          </div>
          <div className="rounded-lg border border-line px-2.5 py-2">
            <div className="text-ink-400">端口</div>
            <div className="mono-num mt-0.5 text-ink-900">{node?.ssh_port}</div>
          </div>
          <div className="rounded-lg border border-line px-2.5 py-2">
            <div className="text-ink-400">规格</div>
            <div className="mono-num mt-0.5 text-ink-900">{node?.flavor}</div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
