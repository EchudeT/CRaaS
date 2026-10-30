import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { Card, Empty, toast } from '@/components/ui'
import { ResourceLabel, SceneBar, sceneUrl, useScene } from '@/components/SceneContext'

const LINKS: Record<string, string> = { image: '/resources/images', device: '/entities', compute: '/resources/compute', storage: '/resources/storage', network: '/resources/network' }
const NAMES: Record<string, string> = { image: '镜像', compute: '计算', storage: '存储', network: '网络' }

export default function ResourcesOverview() {
  const [scene, setScene] = useScene()
  const [data, setData] = useState<Awaited<ReturnType<typeof api.resourceOverview>> | null>(null)
  useEffect(() => {
    let active = true
    setData(null)
    api.resourceOverview(scene).then((r) => { if (active) setData(r) }).catch(() => { if (active) toast('加载资源失败', 'error') })
    return () => { active = false }
  }, [scene])
  return <div className="space-y-4">
    <SceneBar scene={scene} onChange={setScene} />
    <Card className="space-y-2 p-4">
      <h2 className="text-sm font-semibold">场景关联资源</h2>
      <p className="text-xs leading-6 text-ink-500">展示当前场景关联的镜像、计算、存储与网络。当前有 {data?.demo_count ?? 0} 条演示记录，演示容量与指标不代表真实平台资源。实体目录另列为逻辑类型。</p>
      <p className="text-xs leading-6 text-ink-500">真实资源同步或录入后，可在资源列表关联所属场景，并移除演示资源的场景关联；模板及实体目录可继续复用。</p>
    </Card>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{data?.cards.map((c) => <Link key={c.id} to={sceneUrl(LINKS[c.id], scene)}>
      <Card hover className="h-full space-y-2 p-4"><div className="text-2xl font-semibold">{c.count} <span className="text-xs font-normal text-ink-400">{c.unit}</span></div><div className="text-sm font-medium">{c.name}</div><p className="text-xs text-ink-500">{c.desc}</p></Card>
    </Link>)}</div>
    {data && Object.entries(data.resources).map(([kind, rows]) => <Card key={kind} className="overflow-hidden">
      <div className="flex justify-between border-b border-line p-4 text-sm font-semibold"><span>{NAMES[kind]}资源 · {rows.length}</span><Link className="text-xs text-brand-600" to={sceneUrl(LINKS[kind], scene)}>查看与管理 →</Link></div>
      {rows.length ? <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">{rows.map((r) => <div key={r.id} className="rounded-lg border border-line p-3"><div className="text-xs font-medium">{r.name}</div><ResourceLabel item={r} /><div className="mt-2 text-[11px] text-ink-400">{r.status}</div></div>)}</div> : <Empty text="该场景暂无关联资源" />}
    </Card>)}
  </div>
}
