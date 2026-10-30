import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '@/lib/api'
import type { SceneInfo, ResourceContext } from '@/lib/types'
import { Badge, Button, Card, Modal, Select, toast } from './ui'

export function useScene() {
  const [params, setParams] = useSearchParams()
  const scene = params.get('scene') || ''
  const setScene = (value: string) => setParams((current) => {
    const next = new URLSearchParams(current)
    if (value) next.set('scene', value)
    else next.delete('scene')
    return next
  })
  return [scene, setScene] as const
}

export function sceneUrl(path: string, scene: string) {
  return scene ? `${path}?scene=${encodeURIComponent(scene)}` : path
}

// 切换场景或离开页面后，忽略仍在返回的旧请求。
export function useRequestGuard(scope: string) {
  const revision = useRef(0)
  useEffect(() => () => { revision.current++ }, [scope])
  return () => {
    const current = ++revision.current
    return () => current === revision.current
  }
}

export function SceneBar({ scene, onChange }: { scene: string; onChange: (value: string) => void }) {
  const [scenes, setScenes] = useState<SceneInfo[]>([])
  useEffect(() => { api.scenes().then((r) => setScenes(r.items)).catch(() => setScenes([])) }, [])
  return <Card className="flex flex-wrap items-center gap-3 p-3 text-xs">
    <span className="font-medium">所属场景</span>
    <Select value={scene} onChange={onChange} options={[{ value: '', label: '全部场景' }, ...scenes.map((s) => ({ value: s.id, label: s.name }))]} className="w-64" />
    <div className="flex flex-wrap gap-3 text-brand-600">
      <Link to={sceneUrl('/entities', scene)}>实体目录</Link>
      <Link to={sceneUrl('/templates', scene)}>示例与模板</Link>
      <Link to={sceneUrl('/resources', scene)}>关联资源</Link>
      <Link to={sceneUrl('/instances', scene)}>场景实例</Link>
      <Link to={sceneUrl('/monitor', scene)}>监控</Link>
    </div>
  </Card>
}

export function DataBadge({ demo }: { demo?: boolean }) {
  return demo ? <Badge className="border-amber-200 bg-amber-50 text-amber-700">演示数据</Badge> : null
}

export function ResourceLabel({ item }: { item: ResourceContext }) {
  return <span className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-ink-500">
    <DataBadge demo={item.is_demo} />
    {!item.is_demo && <span>{item.data_origin === 'synced' ? '平台同步' : '已录入 · 来源待核验'}</span>}
    {(item.scene_names ?? []).map((s) => <span key={s}>{s}</span>)}
    {!item.scene_names?.length && <span>场景未关联</span>}
  </span>
}

export const metricSource = (source?: string) => ({ demo: '演示指标', mock: '模拟指标', fallback: '采集失败 · 模拟指标', real: '实时采集' }[source || ''] || '来源未确认')

export function ResourceAssociation({ item, kind, onSaved }: { item: ResourceContext & { id: string }; kind: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [scenes, setScenes] = useState<SceneInfo[]>([])
  const [chosen, setChosen] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  async function edit() {
    try {
      const result = await api.scenes()
      setScenes(result.items)
      setChosen(item.scene_ids || [])
      setOpen(true)
    } catch { toast('加载场景失败', 'error') }
  }
  async function save() {
    setBusy(true)
    try { await api.assignResourceScenes(kind, item.id, chosen); setOpen(false); onSaved(); toast('所属场景已更新') }
    catch { toast('保存场景关联失败', 'error') }
    finally { setBusy(false) }
  }
  return <>
    <ResourceLabel item={item} />
    <button type="button" onClick={edit} className="mt-1 text-[10px] text-brand-600 hover:underline">关联场景</button>
    <Modal open={open} onClose={() => setOpen(false)} title="关联资源所属场景" width="max-w-lg" footer={<Button onClick={save} disabled={busy}>{busy ? '保存中…' : '保存关联'}</Button>}>
      <p className="mb-3 text-xs leading-6 text-ink-500">可关联多个场景。取消勾选可移除关联；此操作不部署、迁移或删除资源，也不会改变来源标记。</p>
      <div className="space-y-3">{scenes.map((s) => <label key={s.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={chosen.includes(s.id)} onChange={(e) => setChosen(e.target.checked ? [...chosen, s.id] : chosen.filter((id) => id !== s.id))} />{s.name}</label>)}</div>
    </Modal>
  </>
}
