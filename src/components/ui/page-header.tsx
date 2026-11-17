import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

// Maroon header band shared by admin pages, matching the employee Day/Dashboard headers
export function PageHeader({ eyebrow, title, subtitle, back, actions, children }: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  back?: { href: string; label: string }
  actions?: React.ReactNode
  children?: React.ReactNode // extra content inside the band (progress, tabs…)
}) {
  return (
    <div className="space-y-4">
      {back && (
        <Link href={back.href} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900">
          <ArrowLeft className="h-4 w-4" /> {back.label}
        </Link>
      )}
      <div className="rounded-2xl bg-gradient-to-br from-red-800 to-red-950 px-6 py-6 text-white sm:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-red-100/70">{eyebrow}</p>}
            <h1 className="font-brand truncate text-2xl font-bold sm:text-[1.7rem]">{title}</h1>
            {subtitle && <div className="mt-1 text-sm text-red-100/80">{subtitle}</div>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
        </div>
        {children && <div className="mt-5">{children}</div>}
      </div>
    </div>
  )
}

// Buttons that sit on the maroon band
export const bandButton = 'inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-red-900 transition-[background-color,transform] hover:bg-red-50 active:scale-[0.98]'
export const bandButtonGhost = 'inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-3.5 py-2 text-sm font-medium text-white transition-[background-color,transform] hover:bg-white/10 active:scale-[0.98]'
