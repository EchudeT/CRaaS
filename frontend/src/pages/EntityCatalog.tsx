import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { EntityInfo, SceneInfo } from '@/lib/types'
import { Card, Empty, Input, Select, toast } from '@/components/ui'
import { SceneBar, useScene } from '@/components/SceneContext'

export default function EntityCatalog() {
  const [scene, setScene] = useScene()
  const [scenes, setScenes] = useState<SceneInfo[]>([])
  const [items, setItems] = useState<(EntityInfo & { scene_name: string })[]>([])
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => { api.scenes().then((r) => setScenes(r.items)).catch(() => setError('场景目录加载失败')) }, [])
  useEffect(() => {
    let active = true
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const selected = scenes.filter((s) => !scene || s.id === scene)
        if (scene && !selected.length && scenes.length) throw new Error('不支持的网络场景')
        const rows = await Promise.all(selected.map(async (s) => {
          const result = await api.entities(s.id, q, category)
          return result.items.map((e) => ({ ...e, scene_name: s.name }))
        }))
        if (active) { setItems(rows.flat()); setError('') }
      } catch (e) { if (active) { setItems([]); setError(String(e)); toast('实体目录加载失败', 'error') } }
      finally { if (active) setLoading(false) }
    }, 200)
    return () => { active = false; clearTimeout(timer) }
  }, [scene, q, category, scenes])
  return <div className="space-y-4">
    <SceneBar scene={scene} onChange={(s) => { setCategory(''); setScene(s) }} />
    <Card className="space-y-3 p-4">
      <h2 className="font-semibold">三类实体目录</h2>
      <p className="text-xs text-ink-500">浏览严格抽取使用的已有类型与别名。目录类型不代表已部署设备，无需调用模型。</p>
      <div className="flex flex-wrap gap-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索实体名称、ID 或别名" className="w-72" />
        <Select value={category} onChange={setCategory} options={[{ value: '', label: '全部分类' }, ...(scenes.find((s) => s.id === scene)?.categories ?? []).map((c) => ({ value: c.id, label: c.name }))]} className="w-64" />
        <span className="self-center text-xs text-ink-500">{loading ? '加载中…' : `${items.length} 类实体`}</span>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </Card>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((e) => <Card key={e.entity_type_id} className="space-y-2 p-4">
        <h3 className="text-sm font-semibold">{e.canonical_name}</h3>
        <div className="break-all font-mono text-[11px] text-brand-600">{e.entity_type_id}</div>
        <div className="text-xs text-ink-500">{e.scene_name} · {e.category_name}</div>
        <div className="flex flex-wrap gap-1">{e.aliases.map((a) => <span key={a} className="rounded bg-slate-50 px-2 py-1 text-[11px] text-ink-600">{a}</span>)}</div>
      </Card>)}
    </div>
    {!loading && !error && !items.length && <Empty text="没有匹配的实体类型" />}
  </div>
}
