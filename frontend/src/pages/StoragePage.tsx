import { Database, HardDrive, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { StorageRes } from '@/lib/types'
import { Badge, Card, Empty, Progress, StatCard, toast } from '@/components/ui'
import { shortTime } from '@/lib/utils'
import { ResourceAssociation, SceneBar, useScene, useRequestGuard } from '@/components/SceneContext'

export default function StoragePage() {
  const [scene, setScene] = useScene()
  const beginRequest = useRequestGuard(scene)
  const [items, setItems] = useState<StorageRes[]>([])

  function load() {
    const current = beginRequest()
    api.storage(scene).then((r) => { if (current()) setItems(r.items) }).catch(() => { if (current()) { setItems([]); toast('加载存储资源失败', 'error') } })
  }
  useEffect(load, [scene])

  const total = items.reduce((s, i) => s + i.capacity_tb, 0)
  const used = items.reduce((s, i) => s + i.used_tb, 0)

  return (
    <div className="space-y-4">
      <SceneBar scene={scene} onChange={setScene} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="存储池" value={items.length} suffix="个" icon={<Database className="h-4 w-4" />} />
        <StatCard label="总容量" value={total} suffix="TB" tone="muted" icon={<HardDrive className="h-4 w-4" />} />
        <StatCard label="已使用" value={used} suffix="TB" tone="warn" icon={<HardDrive className="h-4 w-4" />} />
        <StatCard
          label="平均 IOPS"
          value={Math.round(items.reduce((s, i) => s + i.iops, 0) / Math.max(items.length, 1) / 1000)}
          suffix="K"
          tone="brand"
          icon={<Zap className="h-4 w-4" />}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-3.5">
          <div className="text-[13.5px] font-semibold text-ink-900">存储资源列表</div>
          <div className="mt-0.5 text-[11.5px] text-ink-500">分布式块存储、共享文件存储与对象存储</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-line bg-slate-50/70 text-left text-[11.5px] text-ink-500">
                <th className="px-4 py-2.5 font-medium">存储池</th>
                <th className="px-4 py-2.5 font-medium">类型</th>
                <th className="px-4 py-2.5 font-medium">资源池</th>
                <th className="px-4 py-2.5 font-medium">容量</th>
                <th className="px-4 py-2.5 font-medium w-[220px]">使用率</th>
                <th className="px-4 py-2.5 font-medium">IOPS</th>
                <th className="px-4 py-2.5 font-medium">协议</th>
                <th className="px-4 py-2.5 font-medium">状态</th>
                <th className="px-4 py-2.5 font-medium">创建时间</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="border-b border-line/70 last:border-0 hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 font-medium text-ink-900">{s.name}<ResourceAssociation item={s} kind="storage" onSaved={load} /></td>
                  <td className="px-4 py-2.5 text-ink-600">{s.storage_type}</td>
                  <td className="px-4 py-2.5 text-ink-600">{s.site}</td>
                  <td className="mono-num px-4 py-2.5 text-ink-600">
                    {s.used_tb} / {s.capacity_tb} TB
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Progress value={s.usage} tone={s.usage > 80 ? 'danger' : s.usage > 60 ? 'warn' : 'brand'} />
                      <span className="mono-num w-10 text-right text-[11.5px] text-ink-500">{s.usage}%</span>
                    </div>
                  </td>
                  <td className="mono-num px-4 py-2.5 text-ink-600">{s.iops.toLocaleString()}</td>
                  <td className="px-4 py-2.5">
                    <Badge className="border-slate-200 bg-slate-50 text-ink-500">{s.protocol}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge className="border-ok/25 bg-ok/10 text-ok" dot>
                      {s.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-ink-500">{shortTime(s.created_at).slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {items.length === 0 && <Empty text="暂无存储资源" icon={<Database className="h-6 w-6" />} />}
      </Card>
    </div>
  )
}
