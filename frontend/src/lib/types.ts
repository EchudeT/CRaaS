export type NodeType =
  | 'router'
  | 'switch'
  | 'firewall'
  | 'server'
  | 'pc'
  | 'kali'
  | 'plc'
  | 'ids'
  | 'cloud'
  | 'transport'

export interface Zone {
  id: string
  name: string
  cidr: string
  color: string
}

export interface TopoNode {
  id: string
  name: string
  type: NodeType
  zone: string
  ip: string
  image: string
  flavor: string
  cpu: number
  memory: number
  disk: number
  ports: number
  role: string
  canonical_name?: string
  raw_name?: string
  category?: string
  interfaces?: unknown[]
  entity_type_id?: string
  quantity?: number
  attributes?: Record<string, unknown>
  evidence?: string
  confidence?: number
  status?: string
  x?: number
  y?: number
}

export interface TopoLink {
  id: string
  source: string
  target: string
  src_port: string
  dst_port: string
  cidr: string
  bandwidth: string
  relation_type?: string
  interface?: string
  protocol?: string
  label?: string
  directed?: boolean
  evidence?: string
}

export interface Scenario {
  kind?: 'logical'
  schema_version?: string
  name: string
  description: string
  industry: string
  business: string
  zones: Zone[]
  nodes: TopoNode[]
  links: TopoLink[]
  meta: {
    generator: string
    zone_count: number
    node_count: number
    link_count: number
    host_count: number
    model?: string
    scene?: string
    scene_name?: string
    secondary_scenes?: string[]
    scene_confidence?: number
    unresolved_items?: string[]
    deployment_ready?: boolean
  }
}

export interface Issue {
  level: 'error' | 'warn'
  code: string
  message: string
  node_id: string
}

export interface Validation {
  issues: Issue[]
  error_count: number
  warn_count: number
  passed: boolean
  stats: { zones: number; nodes: number; links: number; subnets: number }
}

export interface GenerateResult {
  scenario: Scenario
  validation: Validation
  generator: string
  model?: string
  repair_attempted?: boolean
  extraction?: Record<string, unknown>
  raw_analysis?: string
}

export interface GenerationJob {
  id: string
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  stage: string
  characters: number
  created_at: number
  model: string
  result: GenerateResult | null
  error: string
}

export interface Template {
  id: string
  name: string
  description: string
  industry: string
  business: string
  business_name: string
  zone_count: number
  node_count: number
  source: string
  topology: Scenario
  created_at: string
  updated_at: string
}

export interface InstanceNode {
  id: string
  name: string
  type: NodeType
  zone: string
  ip: string
  image: string
  flavor: string
  cpu: number
  memory: number
  disk: number
  status: string
  ssh_port: number
  username: string
  password: string
}

export interface Instance {
  id: string
  name: string
  template_id: string
  template_name: string
  business: string
  business_name: string
  status: 'provisioning' | 'running' | 'failed' | 'destroyed'
  stage: string
  progress: number
  station: string
  profile: Record<string, any>
  nodes: InstanceNode[]
  created_at: string
  updated_at: string
}

export interface PreviewWorkload {
  id: string
  name: string
  type: NodeType
  zone: string
  ip: string
  image: string
  image_ready: boolean
  flavor: string
  cpu: number
  memory: number
  disk: number
}

export interface Preview {
  template: { id: string; name: string; business: string; zone_count: number; node_count: number }
  profile: { id: string; name: string; cpu: number; memory: number }
  business: string
  business_name: string
  station: string
  workload: PreviewWorkload[]
  checks: { name: string; status: string; detail: string }[]
  estimate: {
    cpu: number
    memory_gb: number
    disk_gb: number
    cost_per_hour: number
    eta_seconds: number
  }
}

export interface ImageRes {
  id: string
  name: string
  category: string
  sub_category: string
  os_type: string
  size_gb: number
  version: string
  source: string
  status: string
  arch: string
  created_at: string
}

export interface ComputeRes {
  id: string
  name: string
  node_type: string
  cluster: string
  ip: string
  port: number
  os_type: string
  pool: string
  domain: string
  site: string
  cpu_cores: number
  memory_mb: number
  cpu_model: string
  gpu_model: string
  gpu_count: number
  gpu_mem: number
  raid: string
  price_per_hour: number
  status: string
  api: string
  created_at: string
}

export interface StorageRes {
  id: string
  name: string
  storage_type: string
  site: string
  capacity_tb: number
  used_tb: number
  usage: number
  iops: number
  protocol: string
  price_per_gb: number
  status: string
  created_at: string
}

export interface NetworkRes {
  id: string
  name: string
  network_type: string
  cidr: string
  vlan: number
  bandwidth: string
  site: string
  used_ips: number
  total_ips: number
  status: string
  created_at: string
}

export interface Metrics {
  cpu: number
  memory: number
  storage: number
  network: number
  bandwidth_in: number
  bandwidth_out: number
  latency: number
}

export interface Pool {
  name: string
  region: string
  latency: string
  node_count: number
  cpu: number
  memory: number
  storage: number
  network: number
  bandwidth: number
  cost_per_hour: number
  status: string
}

export interface MonitorOverview {
  pools: Pool[]
  nodes: {
    id: string
    name: string
    site: string
    ip: string
    cpu_cores: number
    memory_mb: number
    gpu: string
    status: string
    metrics: Metrics
  }[]
  summary: {
    pool_count: number
    node_count: number
    instance_count: number
    cpu_avg: number
    cost_per_hour: number
  }
}

export interface DispatchEvent {
  id: string
  level: 'info' | 'warning' | 'critical'
  title: string
  instance_id: string
  instance_name: string
  node_name: string
  metric: string
  trigger_desc: string
  suggestion: string
  action_label: string
  before: Record<string, number>
  after: Record<string, number>
  status: 'pending' | 'executed' | 'ignored'
  created_at: string
}

export interface Business {
  id: string
  name: string
  desc: string
  rule: string
}
