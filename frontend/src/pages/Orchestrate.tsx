import { ArrowRight, Boxes, CheckCircle2, Layers, Layers3, Server, ShieldCheck, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type Meta } from '@/lib/api'
import type { Template } from '@/lib/types'
import { businessIcon } from '@/components/nodeMeta'
import { Badge, Button, Card, Empty, Tabs, toast } from '@/components/ui'
import { cn, shortTime } from '@/lib/utils'

const LEFT_ITEMS = [
  { icon: Layers3, title: '统一资源编排', desc: '算力、网络、存储与镜像资源统一建模，跨站点统一调度' },
  { icon: Boxes, title: '九大业务入口', desc: '围绕 HRO 九类业务场景，一键完成模板落位与参数配置' },
  { icon: ShieldCheck, title: 'HRO 推荐校验', desc: '由智能体给出资源规格建议，部署前完成连通性与配额校验' },
]

export default function Orchestrate() {
  const nav = useNavigate()
  const [meta, setMeta] = useState<Meta | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [biz, setBiz] = useState('')

  useEffect(() => {
    api.meta().then(setMeta).catch(() => setMeta(null))
    api.templates().then((r) => setTemplates(r.items)).catch(() => toast('加载模板失败', 'error'))
  }, [])

  const list = useMemo(() => (biz ? templates.filter((t) => t.business === biz) : templates), [templates, biz])
  const cards = list.slice(0, 6)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[268px_minmax(0,1fr)]">
        {/* 左侧说明 */}
        <Card className="h-fit p-5">
          <div className="text-[13.5px] font-semibold text-ink-900">混合资源编排</div>
          <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-400">
            Hybrid Resource Orchestration
          </div>
          <p className="mt-2.5 text-[12px] leading-5 text-ink-500">
            面向演练、训练与评测等复杂任务，统一编排算力、网络与镜像资源，以最低成本、较好体验快速生成业务所需靶场。
          </p>
          <div className="mt-4 space-y-3">
            {LEFT_ITEMS.map((it) => {
              const Icon = it.icon
              return (
                <div key={it.title} className="flex gap-2.5">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <div className="text-[12.5px] font-medium text-ink-900">{it.title}</div>
                    <div className="mt-0.5 text-[11px] leading-4 text-ink-500">{it.desc}</div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-4 rounded-lg border border-line bg-slate-50/70 p-3">
            <div className="flex items-center justify-between text-[11.5px]">
              <span className="text-ink-500">可部署模板</span>
              <span className="mono-num font-semibold text-ink-900">{templates.length}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11.5px]">
              <span className="text-ink-500">资源池</span>
              <span className="mono-num font-semibold text-ink-900">{meta?.stations.length ?? 3}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11.5px]">
              <span className="text-ink-500">业务类型</span>
              <span className="mono-num font-semibold text-ink-900">{meta?.business.length ?? 9}</span>
            </div>
          </div>
        </Card>

        {/* 右侧 */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13.5px] font-semibold text-ink-900">九类业务入口</div>
                <div className="mt-0.5 text-[11.5px] text-ink-500">选择业务类型，快速定位可用的场景模板</div>
              </div>
              <Badge className="border-brand-200 bg-brand-50 text-brand-600" dot>
                HRO · 9 类业务
              </Badge>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {(meta?.business ?? []).map((b) => {
                const Icon = businessIcon[b.id] ?? Sparkles
                const active = biz === b.id
                return (
                  <button
                    key={b.id}
                    onClick={() => setBiz(active ? '' : b.id)}
                    className={cn(
                      'group cursor-pointer rounded-xl border p-3 text-left transition-all duration-200',
                      active
                        ? 'border-brand-400 bg-brand-50/70 shadow-sm'
                        : 'border-line bg-white hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
                          active ? 'border-brand-300 bg-white text-brand-600' : 'border-line bg-slate-50 text-ink-500 group-hover:text-brand-600',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      {active && <CheckCircle2 className="h-4 w-4 text-brand-500" />}
                    </div>
                    <div className="mt-2 text-[12.5px] font-medium text-ink-900">{b.name}</div>
                    <div className="mt-0.5 line-clamp-2 text-[10.5px] leading-4 text-ink-400">{b.desc}</div>
                  </button>
                )
              })}
            </div>
          </Card>

          <div>
            <div className="mb-2.5 flex items-end justify-between">
              <div>
                <div className="text-[13.5px] font-semibold text-ink-900">场景模板 · 一键部署</div>
                <div className="mt-0.5 text-[11.5px] text-ink-500">
                  {biz ? `已筛选「${meta?.business.find((b) => b.id === biz)?.name}」` : '展示全部可部署场景'}
                </div>
              </div>
              <Tabs
                value={biz}
                onChange={setBiz}
                items={[{ value: '', label: '全部' }, ...(meta?.business ?? []).slice(0, 4).map((b) => ({ value: b.id, label: b.name }))]}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {cards.map((t) => (
                <Card key={t.id} hover className="flex flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Badge className="border-ok/25 bg-ok/10 text-ok" dot>
                          可用
                        </Badge>
                        <span className="text-[10px] text-ink-400">HRO 已校验</span>
                      </div>
                      <div className="mt-1.5 truncate text-[13.5px] font-semibold text-ink-900">{t.name}</div>
                      <div className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-ink-400">{t.description}</div>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1 border-t border-dashed border-line pt-2.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-ink-400">最近更新</span>
                      <span className="text-ink-700">{shortTime(t.updated_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-400">可部署对象</span>
                      <span className="mono-num text-ink-700">
                        {t.node_count} 节点 / {t.zone_count} 区域
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-400">推荐站点</span>
                      <span className="text-ink-700">{meta?.stations[0]?.name ?? '深圳（总部）资源池'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-400">部署模式</span>
                      <span className="mono-num text-ink-700">training_education</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex-1"
                      onClick={() => nav(`/orchestrate/${t.id}?business=${t.business}`)}
                      icon={<Server className="h-3.5 w-3.5" />}
                    >
                      立即部署
                    </Button>
                    <Link to={`/templates/${t.id}`}>
                      <Button variant="secondary" size="sm" icon={<Layers className="h-3.5 w-3.5" />}>
                        模板
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
            {cards.length === 0 && (
              <Card>
                <Empty text="该业务下暂无可用模板" icon={<Boxes className="h-6 w-6" />} />
              </Card>
            )}
          </div>

          <Card className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-brand-50/70 to-cyan-50/40 px-5 py-3.5">
            <div className="flex items-center gap-2 text-[12.5px] text-ink-700">
              <Sparkles className="h-4 w-4 text-brand-500" />
              没有合适的模板？用自然语言描述场景，一次生成拓扑并自动沉淀为模板。
            </div>
            <Link to="/topology">
              <Button variant="secondary" size="sm" icon={<ArrowRight className="h-3.5 w-3.5" />}>
                去构建场景
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  )
}
