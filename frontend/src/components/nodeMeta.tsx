import {
  Bug,
  Cloud,
  Cpu,
  Crosshair,
  FileSearch,
  FlaskConical,
  Monitor,
  Network,
  Radar,
  RotateCcw,
  Router,
  Server,
  Shield,
  ShieldCheck,
  Swords,
  Terminal,
  BookOpen,
  type LucideIcon,
} from 'lucide-react'
import type { NodeType } from '@/lib/types'

export const nodeMeta: Record<NodeType, { icon: LucideIcon; color: string; label: string }> = {
  router: { icon: Router, color: '#0072CE', label: '路由器' },
  switch: { icon: Network, color: '#0E7C86', label: '交换机' },
  firewall: { icon: Shield, color: '#B5179E', label: '防火墙' },
  server: { icon: Server, color: '#6D5BD0', label: '服务器' },
  pc: { icon: Monitor, color: '#0072CE', label: '办公终端' },
  kali: { icon: Terminal, color: '#C2410C', label: '攻击终端' },
  plc: { icon: Cpu, color: '#D98324', label: 'PLC 设备' },
  ids: { icon: Radar, color: '#0891B2', label: '入侵检测' },
  cloud: { icon: Cloud, color: '#3A93DE', label: '互联网' },
  transport: { icon: Network, color: '#0E7C86', label: 'PTN传送设备' },
}

export const businessIcon: Record<string, LucideIcon> = {
  drill: Swords,
  pentest: Crosshair,
  vuln: Bug,
  course: BookOpen,
  skill: ShieldCheck,
  ad: ShieldCheck,
  ir: FileSearch,
  replay: RotateCcw,
  research: FlaskConical,
}
