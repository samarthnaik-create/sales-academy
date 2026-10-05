import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { Sidebar } from '@/components/layout/sidebar'

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.user.role === 'admin') redirect('/admin')

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50">
      <Sidebar userName={session.user.name ?? 'User'} role={session.user.role} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
