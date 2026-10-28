import { Network, Share2, Wifi } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { NetworkRes } from '@/lib/types'
import { Badge, Card, Empty, Progress, StatCard, toast } from '@/components/ui'
import { shortTime } from '@/lib/utils'

export default function NetworkPage() {
  const [items, setItems] = useState<NetworkRes[]>([])

  useEffect(() => {
    api.network().then((r) => setItems(r.items)).catch(() => toast('加载网络资源失败', 'error'))
  }, [])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="网络资源" value={items.length} suffix="个" icon={<Network className="h-4 w-4" />} />
        <StatCard label="IP 总量" value={items.reduce((s, i) => s + i.total_ips, 0)} suffix="个" tone="muted" icon={<Share2 className="h-4 w-4" />} />
        <StatCard label="已分配 IP" value={items.reduce((s, i) => s + i.used_ips, 0)} suffix="个" tone="warn" icon={<Share2 className="h-4 w-4" />} />
        <StatCard label="专线通道" value={items.filter((i) => i.network_type === '专线通道').length} suffix="条" tone="brand" icon={<Wifi className="h-4 w-4" />} />
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-3.5">
          <div className="text-[13.5px] font-semibold text-ink-900">网络资源列表</div>
          <div className="mt-0.5 text-[11.5px] text-ink-500">虚拟网络、VLAN 隔离与跨站点专线通道</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-line bg-slate-50/70 text-left text-[11.5px] text-ink-500">
                <th className="px-4 py-2.5 font-medium">网络名称</th>
                <th className="px-4 py-2.5 font-medium">类型</th>
                <th className="px-4 py-2.5 font-medium">网段</th>
                <th className="px-4 py-2.5 font-medium">VLAN</th>
                <th className="px-4 py-2.5 font-medium">带宽</th>
                <th className="px-4 py-2.5 font-medium">资源池</th>
                <th className="px-4 py-2.5 font-medium w-[200px]">IP 使用率</th>
                <th className="px-4 py-2.5 font-medium">状态</th>
                <th className="px-4 py-2.5 font-medium">创建时间</th>
              </tr>
            </thead>
            <tbody>
              {items.map((n) => {
                const usage = Math.round((n.used_ips / Math.max(n.total_ips, 1)) * 100)
                return (
                  <tr key={n.id} className="border-b border-line/70 last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 font-medium text-ink-900">{n.name}</td>
                    <td className="px-4 py-2.5">
                      <Badge className="border-slate-200 bg-slate-50 text-ink-500">{n.network_type}</Badge>
                    </td>
                    <td className="mono-num px-4 py-2.5 text-ink-600">{n.cidr}</td>
                    <td className="mono-num px-4 py-2.5 text-ink-600">{n.vlan}</td>
                    <td className="mono-num px-4 py-2.5 text-ink-600">{n.bandwidth}</td>
                    <td className="px-4 py-2.5 text-ink-600">{n.site}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Progress value={usage} tone={usage > 80 ? 'danger' : usage > 60 ? 'warn' : 'brand'} />
                        <span className="mono-num w-16 text-right text-[11.5px] text-ink-500">
                          {n.used_ips}/{n.total_ips}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge className="border-ok/25 bg-ok/10 text-ok" dot>
                        {n.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-ink-500">{shortTime(n.created_at).slice(0, 10)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {items.length === 0 && <Empty text="暂无网络资源" icon={<Network className="h-6 w-6" />} />}
      </Card>
    </div>
  )
}
