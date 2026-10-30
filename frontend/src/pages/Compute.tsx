import { Cpu, Gauge, Plus, Server, Wifi } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { ComputeRes } from '@/lib/types'
import { Badge, Button, Card, Empty, Field, Input, Modal, Select, StatCard, Tabs, toast } from '@/components/ui'
import { gb, money, shortTime } from '@/lib/utils'
import { ResourceAssociation, SceneBar, useScene, useRequestGuard } from '@/components/SceneContext'

const TABS = [
  { value: 'base', label: '基础信息' },
  { value: 'spec', label: '规格容量' },
  { value: 'price', label: '计价信息' },
  { value: 'system', label: '系统配置' },
]

export default function Compute() {
  const [scene, setScene] = useScene()
  const beginRequest = useRequestGuard(scene)
  const [items, setItems] = useState<ComputeRes[]>([])
  const [summary, setSummary] = useState({ total: 0, online: 0, schedulable: 0 })
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('base')
  const [form, setForm] = useState({
    name: '计算节点-new-01',
    node_type: '物理机',
    cluster: 'hg-cluster-01',
    ip: '10.10.10.100',
    port: 18000,
    os_type: 'Linux',
    pool: '计算资源',
    domain: 'private',
    site: '深圳（总部）资源池',
    cpu_cores: 64,
    memory_mb: 262144,
    cpu_model: 'Intel(R) Xeon(R) Platinum 8358',
    gpu_model: 'NVIDIA A100',
    gpu_count: 4,
    gpu_mem: 80,
    raid: 'RAID10',
    price_per_hour: 1.2,
    api: 'http://10.10.10.100:18000/api/v1',
  })

  function load() {
    const current = beginRequest()
    api
      .compute(scene)
      .then((r) => {
        if (!current()) return
        setItems(r.items)
        setSummary(r.summary)
      })
      .catch(() => { if (current()) { setItems([]); setSummary({ total: 0, online: 0, schedulable: 0 }); toast('加载计算资源失败', 'error') } })
  }

  useEffect(() => {
    load()
  }, [scene])

  async function submit() {
    try {
      await api.addCompute({ ...form, scene_ids: scene ? [scene] : [] })
      toast('计算资源已接入')
      setOpen(false)
      load()
    } catch {
      toast('接入失败', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <SceneBar scene={scene} onChange={setScene} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="计算节点" value={summary.total} suffix="台" icon={<Server className="h-4 w-4" />} />
        <StatCard label="可用节点" value={summary.online} suffix="台" tone="ok" icon={<Wifi className="h-4 w-4" />} />
        <StatCard label="可调度节点" value={summary.schedulable} suffix="台" tone="brand" icon={<Gauge className="h-4 w-4" />} />
        <StatCard
          label="总算力"
          value={items.reduce((s, i) => s + i.cpu_cores, 0)}
          suffix="vCPU"
          tone="muted"
          icon={<Cpu className="h-4 w-4" />}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[13.5px] font-semibold text-ink-900">计算资源列表</div>
          <div className="mt-0.5 text-[11.5px] text-ink-500">物理机、虚拟机与 GPU 节点统一纳管，按小时计价</div>
        </div>
        <Button variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>
          添加计算资源
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-line bg-slate-50/70 text-left text-[11.5px] text-ink-500">
                <th className="px-4 py-2.5 font-medium">计算节点</th>
                <th className="px-4 py-2.5 font-medium">类型</th>
                <th className="px-4 py-2.5 font-medium">所属资源池</th>
                <th className="px-4 py-2.5 font-medium">IP 地址</th>
                <th className="px-4 py-2.5 font-medium">规格</th>
                <th className="px-4 py-2.5 font-medium">GPU</th>
                <th className="px-4 py-2.5 font-medium">状态</th>
                <th className="px-4 py-2.5 font-medium">单价</th>
                <th className="px-4 py-2.5 font-medium">接入时间</th>
              </tr>
            </thead>
            <tbody>
              {items.map((n) => (
                <tr key={n.id} className="border-b border-line/70 last:border-0 hover:bg-slate-50/50">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-ink-900">{n.name}</div>
                    <ResourceAssociation item={n} kind="compute" onSaved={load} />
                    <div className="mono-num text-[10.5px] text-ink-400">{n.cluster}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge className="border-slate-200 bg-slate-50 text-ink-500">{n.node_type}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-ink-600">{n.site}</td>
                  <td className="mono-num px-4 py-2.5 text-ink-600">
                    {n.ip}:{n.port}
                  </td>
                  <td className="mono-num px-4 py-2.5 text-ink-600">
                    {n.cpu_cores} 核 / {gb(n.memory_mb)}
                  </td>
                  <td className="px-4 py-2.5 text-ink-600">
                    {n.gpu_model ? `${n.gpu_model} ×${n.gpu_count}` : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge className="border-ok/25 bg-ok/10 text-ok" dot>
                      {n.status}
                    </Badge>
                  </td>
                  <td className="mono-num px-4 py-2.5 text-ink-600">{money(n.price_per_hour)}/h</td>
                  <td className="px-4 py-2.5 text-ink-500">{shortTime(n.created_at).slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {items.length === 0 && <Empty text="暂无计算资源" icon={<Server className="h-6 w-6" />} />}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="添加计算资源"
        desc="按四层字段规范封装：基础信息 / 规格容量 / 计价信息 / 系统配置"
        width="max-w-2xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button variant="primary" onClick={submit}>
              接入资源池
            </Button>
          </>
        }
      >
        <Tabs items={TABS} value={tab} onChange={setTab} className="mb-4" />
        {tab === 'base' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="设备名称" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="资源类型">
              <Select
                value={form.node_type}
                onChange={(v) => setForm({ ...form, node_type: v })}
                options={['物理机', '虚拟机', 'GPU 节点', '边缘节点'].map((v) => ({ value: v, label: v }))}
              />
            </Field>
            <Field label="IP 地址" required>
              <Input value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })} className="mono-num" />
            </Field>
            <Field label="端口号">
              <Input
                type="number"
                value={form.port}
                onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
                className="mono-num"
              />
            </Field>
            <Field label="所属集群">
              <Input value={form.cluster} onChange={(e) => setForm({ ...form, cluster: e.target.value })} className="mono-num" />
            </Field>
            <Field label="所属资源池">
              <Select
                value={form.site}
                onChange={(v) => setForm({ ...form, site: v })}
                options={['深圳（总部）资源池', '北京（边缘）资源池', '武汉（教学）资源池'].map((v) => ({ value: v, label: v }))}
              />
            </Field>
            <Field label="操作系统">
              <Input value={form.os_type} onChange={(e) => setForm({ ...form, os_type: e.target.value })} />
            </Field>
            <Field label="所属域">
              <Select
                value={form.domain}
                onChange={(v) => setForm({ ...form, domain: v })}
                options={['private', 'public', 'edge'].map((v) => ({ value: v, label: v }))}
              />
            </Field>
          </div>
        )}
        {tab === 'spec' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="CPU 核心数">
              <Input
                type="number"
                value={form.cpu_cores}
                onChange={(e) => setForm({ ...form, cpu_cores: Number(e.target.value) })}
                className="mono-num"
              />
            </Field>
            <Field label="内存 (MB)">
              <Input
                type="number"
                value={form.memory_mb}
                onChange={(e) => setForm({ ...form, memory_mb: Number(e.target.value) })}
                className="mono-num"
              />
            </Field>
            <Field label="CPU 型号" className="col-span-2">
              <Input value={form.cpu_model} onChange={(e) => setForm({ ...form, cpu_model: e.target.value })} />
            </Field>
            <Field label="GPU 型号">
              <Input value={form.gpu_model} onChange={(e) => setForm({ ...form, gpu_model: e.target.value })} />
            </Field>
            <Field label="GPU 数量 / 显存 (GB)">
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={form.gpu_count}
                  onChange={(e) => setForm({ ...form, gpu_count: Number(e.target.value) })}
                  className="mono-num"
                />
                <Input
                  type="number"
                  value={form.gpu_mem}
                  onChange={(e) => setForm({ ...form, gpu_mem: Number(e.target.value) })}
                  className="mono-num"
                />
              </div>
            </Field>
            <Field label="RAID 级别">
              <Select
                value={form.raid}
                onChange={(v) => setForm({ ...form, raid: v })}
                options={['RAID0', 'RAID1', 'RAID5', 'RAID10'].map((v) => ({ value: v, label: v }))}
              />
            </Field>
          </div>
        )}
        {tab === 'price' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="单价 (元/小时)" hint="按节点维度计价，实例化时按占用时长结算">
              <Input
                type="number"
                step="0.1"
                value={form.price_per_hour}
                onChange={(e) => setForm({ ...form, price_per_hour: Number(e.target.value) })}
                className="mono-num"
              />
            </Field>
            <Field label="计费方式">
              <Select value="hour" onChange={() => {}} options={[{ value: 'hour', label: '按小时' }]} />
            </Field>
          </div>
        )}
        {tab === 'system' && (
          <div className="space-y-3">
            <Field label="API 接口">
              <Input value={form.api} onChange={(e) => setForm({ ...form, api: e.target.value })} className="mono-num" />
            </Field>
            <div className="rounded-lg border border-line bg-slate-50 px-3 py-2.5 text-[11.5px] text-ink-500">
              节点接入后将自动注册到调度中心，参与资源水位监控与调度建议计算。演示环境不会真实下发指令。
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
