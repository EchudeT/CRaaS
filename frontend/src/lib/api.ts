import type {
  Business,
  ComputeRes,
  DispatchEvent,
  GenerateResult,
  GenerationJob,
  ImageRes,
  Instance,
  MonitorOverview,
  NetworkRes,
  Preview,
  Scenario,
  StorageRes,
  Template,
  Validation,
  SceneInfo,
  EntityInfo,
} from './types'

const BASE = '/api'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text()
    let message = text || `请求失败 ${res.status}`
    try {
      const parsed = JSON.parse(text)
      if (typeof parsed.detail === 'string') message = parsed.detail
    } catch { /* Non-JSON errors retain the original message. */ }
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

const post = <T>(path: string, body: unknown) =>
  req<T>(path, { method: 'POST', body: JSON.stringify(body) })

export interface Meta {
  business: Business[]
  industries: { id: string; name: string }[]
  stations: { id: string; name: string; region: string; latency: string }[]
  profiles: { id: string; name: string; cpu: number; memory: number }[]
  llm: { ready: boolean; mode: string; model: string; fallback: string }
  scenes?: { id: string; name: string }[]
}

export const api = {
  scenes: () => req<{ items: SceneInfo[] }>('/scenes'),
  entities: (scene: string, q = '', category = '') => req<{ items: EntityInfo[]; total: number }>(`/scenes/${scene}/entities?${new URLSearchParams({ q, category })}`),
  meta: () => req<Meta>('/meta'),

  presets: () => req<{ items: { name: string; description: string; topology: Scenario }[] }>('/topology/presets'),
  generate: (body: { description: string; industry?: string; business?: string; name?: string }) =>
    post<GenerateResult>('/topology/generate', body),
  startGeneration: (body: { description: string; industry?: string; business?: string; scene?: string }) =>
    post<GenerationJob>('/topology/jobs', body),
  generationJob: (id: string) => req<GenerationJob>(`/topology/jobs/${id}`),
  rebuild: (body: { description: string; industry?: string; business?: string; name?: string }) =>
    post<GenerateResult>('/topology/rebuild', body),
  validate: (topology: Scenario) => post<Validation>('/topology/validate', { topology }),

  templates: (params?: { q?: string; business?: string; industry?: string; scene?: string }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.business) qs.set('business', params.business)
    if (params?.industry) qs.set('industry', params.industry)
    if (params?.scene) qs.set('scene', params.scene)
    const s = qs.toString()
    return req<{ items: Template[]; total: number }>(`/templates${s ? `?${s}` : ''}`)
  },
  template: (id: string) => req<Template>(`/templates/${id}`),
  createTemplate: (body: {
    name: string
    description?: string
    industry?: string
    business?: string
    topology: Scenario
    source?: string
  }) => post<Template>('/templates', body),
  updateTemplate: (id: string, body: Record<string, unknown>) =>
    req<Template>(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteTemplate: (id: string) => req<{ ok: boolean }>(`/templates/${id}`, { method: 'DELETE' }),
  validateTemplate: (id: string) => req<Validation>(`/templates/${id}/validate`),

  instances: (scene = '') => req<{ items: Instance[] }>(`/instances?${new URLSearchParams({ scene })}`),
  instance: (id: string) => req<Instance>(`/instances/${id}`),
  instanceStats: () =>
    req<{ running: number; provisioning: number; failed: number; destroyed: number; total_nodes: number }>(
      '/instances/stats',
    ),
  preview: (body: { template_id: string; business: string; station: string; profile: string }) =>
    post<Preview>('/instances/preview', body),
  deploy: (body: {
    template_id: string
    name?: string
    business: string
    station: string
    profile: string
  }) => post<Instance>('/instances', body),
  destroy: (id: string) => post<Instance>(`/instances/${id}/destroy`, {}),

  resourceOverview: (scene = '') =>
    req<{
      cards: { id: string; name: string; count: number; unit: string; desc: string; real: number }[]
      industry_extra: { name: string; count: number }[]
      resources: { image: ImageRes[]; compute: ComputeRes[]; storage: StorageRes[]; network: NetworkRes[] }
      demo_count: number
    }>(`/resources/overview?${new URLSearchParams({ scene })}`),
  images: (params?: { category?: string; q?: string; scene?: string }) => {
    const qs = new URLSearchParams()
    if (params?.category && params.category !== '全部') qs.set('category', params.category)
    if (params?.q) qs.set('q', params.q)
    if (params?.scene) qs.set('scene', params.scene)
    const s = qs.toString()
    return req<{ items: ImageRes[]; categories: string[] }>(`/resources/images${s ? `?${s}` : ''}`)
  },
  addImage: (body: Record<string, unknown>) => post<ImageRes>('/resources/images', body),
  compute: (scene = '') =>
    req<{ items: ComputeRes[]; summary: { total: number; online: number; schedulable: number } }>(
      `/resources/compute?${new URLSearchParams({ scene })}`,
    ),
  addCompute: (body: Record<string, unknown>) => post<ComputeRes>('/resources/compute', body),
  assignResourceScenes: (kind: string, id: string, scene_ids: string[]) => req(`/resources/${kind}/${id}/context`, { method: 'PUT', body: JSON.stringify({ scene_ids }) }),
  storage: (scene = '') => req<{ items: StorageRes[] }>(`/resources/storage?${new URLSearchParams({ scene })}`),
  network: (scene = '') => req<{ items: NetworkRes[] }>(`/resources/network?${new URLSearchParams({ scene })}`),

  monitor: (scene = '') => req<MonitorOverview>(`/monitor/overview?${new URLSearchParams({ scene })}`),
  nodeHistory: (id: string) => req<{ source: string; points: { t: string; cpu: number; memory: number; network: number }[] }>(`/monitor/nodes/${id}/history`),

  events: (status?: string) =>
    req<{ items: DispatchEvent[]; summary: { pending: number; executed: number; ignored: number } }>(
      `/scheduler/events${status ? `?status=${status}` : ''}`,
    ),
  executeEvent: (id: string) => post<DispatchEvent>(`/scheduler/events/${id}/execute`, {}),
  ignoreEvent: (id: string) => post<DispatchEvent>(`/scheduler/events/${id}/ignore`, {}),
}
