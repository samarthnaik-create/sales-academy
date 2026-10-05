'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { BookOpen, LayoutDashboard, Users, LogOut, ShieldCheck, BarChart2, Settings, Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  userName: string
  role: string
}

export function Sidebar({ userName, role }: SidebarProps) {
  const pathname = usePathname()

  const employeeLinks = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/settings', icon: Settings, label: 'Settings' },
  ]

  const adminLinks = [
    { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/admin/employees', icon: Users, label: 'Employees' },
    { href: '/admin/courses', icon: BookOpen, label: 'Courses' },
    { href: '/admin/analytics', icon: BarChart2, label: 'Analytics' },
    { href: '/admin/announcements', icon: Megaphone, label: 'Announcements' },
  ]

  const links = role === 'admin' ? adminLinks : employeeLinks

  return (
    <aside className="w-56 shrink-0 bg-white border-r border-zinc-200 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-zinc-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-xs">SA</span>
          </div>
          <div>
            <p className="text-sm font-bold text-zinc-900 leading-tight">Sales Academy</p>
            {role === 'admin' && (
              <div className="flex items-center gap-1 mt-0.5">
                <ShieldCheck className="h-3 w-3 text-red-600" />
                <span className="text-xs text-red-600 font-medium">Admin</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {links.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/admin' && href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-red-50 text-red-700'
                  : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
              )}
            >
              <Icon className={cn('h-4 w-4', active ? 'text-red-600' : 'text-zinc-400')} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User + signout */}
      <div className="px-3 py-4 border-t border-zinc-100">
        <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <span className="text-red-700 text-xs font-bold">{userName.charAt(0).toUpperCase()}</span>
          </div>
          <span className="text-sm text-zinc-700 font-medium truncate">{userName}</span>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
