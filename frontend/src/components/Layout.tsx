import {
  Activity,
  Bell,
  Boxes,
  ChevronRight,
  Cpu,
  Database,
  Disc3,
  Layers,
  LayoutDashboard,
  Network,
  Search,
  Server,
  Sparkles,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

const NAV: { group: string; items: { to: string; label: string; icon: LucideIcon }[] }[] = [
  { group: '控制台', items: [{ to: '/', label: '总览', icon: LayoutDashboard }] },
  {
    group: '场景编排',
    items: [
      { to: '/topology', label: '智能拓扑构建', icon: Workflow },
      { to: '/templates', label: '场景模板库', icon: Layers },
      { to: '/entities', label: '三类实体目录', icon: Database },
    ],
  },
  {
    group: '场景实例',
    items: [
      { to: '/orchestrate', label: '混合资源编排', icon: Boxes },
      { to: '/instances', label: '场景实例', icon: Server },
    ],
  },
  {
    group: '资源封装',
    items: [
      { to: '/resources', label: '资源总览', icon: Boxes },
      { to: '/resources/images', label: '镜像管理', icon: Disc3 },
      { to: '/resources/compute', label: '计算资源', icon: Cpu },
      { to: '/resources/storage', label: '存储资源', icon: Database },
      { to: '/resources/network', label: '网络资源', icon: Network },
    ],
  },
  {
    group: '智能监控',
    items: [
      { to: '/monitor', label: '资源监控中心', icon: Activity },
      { to: '/scheduler', label: '调度中心', icon: Sparkles },
    ],
  },
]

const TITLES: Record<string, { title: string; sub?: string }> = {
  '/entities': { title: '三类实体目录', sub: '运营商场景的实体类型、分类与别名' },
  '/': { title: '控制台总览', sub: '靶场平台即服务 · Cyber Range as a Service' },
  '/topology': { title: '智能拓扑构建平台', sub: '自然语言 → IaC 代码 → 可视化拓扑' },
  '/templates': { title: '场景模板库', sub: '场景模板的创建、校验与复用' },
  '/orchestrate': { title: '混合资源编排', sub: '围绕 HRO 九类业务快速完成场景落位' },
  '/instances': { title: '场景实例', sub: '场景在靶场中的运行状态与访问方式' },
  '/resources': { title: '资源总览', sub: '资源分类与规范化封装描述' },
  '/resources/images': { title: '镜像管理', sub: '操作系统 / 应用 / 安全工具 / 网络设备 / 环境 / 容器' },
  '/resources/compute': { title: '计算资源', sub: '物理机、虚拟机与 GPU 节点统一纳管' },
  '/resources/storage': { title: '存储资源', sub: '分布式块存储、共享文件存储与对象存储' },
  '/resources/network': { title: '网络资源', sub: '虚拟网络、VLAN 隔离与专线通道' },
  '/monitor': { title: '资源监控中心', sub: '靶场与节点运行状态，自适应调度服务' },
  '/scheduler': { title: '调度中心', sub: '调度建议、影响评估与执行' },
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-5 py-4">
      <div className="relative flex h-8 w-8 items-center justify-center rounded-[9px] bg-gradient-to-br from-brand-500 to-brand-700 shadow-sm">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none">
          <circle cx="12" cy="6" r="2.6" fill="white" opacity="0.95" />
          <circle cx="6" cy="17" r="2.4" fill="white" opacity="0.75" />
          <circle cx="18" cy="17" r="2.4" fill="white" opacity="0.75" />
          <path d="M12 8.6v3.2M10.2 13.2 7.4 15.2M13.8 13.2l2.8 2" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
      <div className="leading-tight">
        <div className="text-[13.5px] font-semibold tracking-tight text-ink-900">靶场平台即服务</div>
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-400">CRaaS Platform</div>
      </div>
    </div>
  )
}

export function Layout() {
  const { pathname } = useLocation()
  const meta =
    TITLES[pathname] ??
    (pathname.startsWith('/templates/')
      ? { title: '场景模板构建与编辑', sub: '代码编辑器 / 图形编辑器 / 拓扑检查器' }
      : pathname.startsWith('/orchestrate/')
        ? { title: 'HRO 场景实例化控制台', sub: '资源匹配、Workload 编排与提交部署' }
        : pathname.startsWith('/instances/')
          ? { title: '场景实例详情', sub: '节点访问方式与资源详情' }
          : { title: '控制台', sub: '' })

  return (
    <div className="flex h-full bg-canvas">
      <aside className="flex w-[218px] shrink-0 flex-col border-r border-line bg-white">
        <Logo />
        <nav className="scrollbar-none flex-1 overflow-y-auto px-3 pb-4">
          {NAV.map((group) => (
            <div key={group.group} className="mb-3">
              <div className="px-2 pb-1.5 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-400">
                {group.group}
              </div>
              {group.items.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[12.5px] transition-colors duration-200',
                        isActive
                          ? 'bg-brand-50 font-medium text-brand-700'
                          : 'text-ink-700 hover:bg-slate-50 hover:text-ink-900',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className={cn('h-[15px] w-[15px]', isActive ? 'text-brand-500' : 'text-ink-400')} />
                        {item.label}
                      </>
                    )}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>
        <div className="border-t border-line px-4 py-3">
          <div className="rounded-lg bg-gradient-to-br from-brand-50 to-cyan-50 p-2.5">
            <div className="text-[11.5px] font-medium text-brand-700">演示环境</div>
            <div className="mt-0.5 text-[10.5px] leading-4 text-ink-500">
              编排执行器为模拟实现，接入真实靶场请对接调度适配层
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line bg-white px-6">
          <div className="flex items-center gap-2 text-[12px] text-ink-400">
            <span>中国移动</span>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-ink-900">{meta.title}</span>
            {meta.sub && (
              <>
                <ChevronRight className="h-3 w-3" />
                <span className="hidden lg:inline">{meta.sub}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[12px] text-ink-400 md:flex">
              <Search className="h-3.5 w-3.5" />
              <input
                placeholder="搜索场景 / 实例"
                className="w-32 bg-transparent outline-none placeholder:text-ink-400"
              />
            </div>
            <button className="relative cursor-pointer rounded-lg border border-line p-1.5 text-ink-500 transition-colors hover:bg-slate-50">
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-danger" />
            </button>
            <div className="ml-1 flex items-center gap-2 rounded-lg border border-line px-2 py-1">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-[10px] font-semibold text-white">
                CM
              </div>
              <div className="hidden leading-tight sm:block">
                <div className="text-[11.5px] font-medium text-ink-900">admin</div>
                <div className="text-[9.5px] text-ink-400">管理员</div>
              </div>
            </div>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1500px] px-6 py-5">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
