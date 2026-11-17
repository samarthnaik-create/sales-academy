export const dynamic = 'force-dynamic'

import { requireAdmin } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { User } from '@/models/User'
import { Course } from '@/models/Course'
import { QuizAttempt, isSubmitted } from '@/models/QuizAttempt'
import { Progress } from '@/models/Progress'
import Link from 'next/link'
import { PageHeader, bandButton, bandButtonGhost } from '@/components/ui/page-header'
import { Users, BookOpen, CheckCircle2, Trophy, ArrowUpRight, UserPlus, Megaphone, ChevronRight } from 'lucide-react'

function timeAgo(date: Date, now: number) {
  const mins = Math.max(0, Math.round((now - new Date(date).getTime()) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return days < 30 ? `${days}d ago` : new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function greeting(now: Date) {
  const hour = Number(now.toLocaleString('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }))
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}

export default async function AdminPage() {
  const admin = await requireAdmin()
  await connectDB()

  const [employeeDocs, courses] = await Promise.all([
    User.find({ role: 'employee' }, { name: 1 }).lean(),
    Course.find({}, { title: 1, dayNumber: 1 }).sort({ dayNumber: 1 }).lean(),
  ])
  const employeeIds = employeeDocs.map(e => e._id)
  const [allProgress, allAttempts] = await Promise.all([
    Progress.find({ userId: { $in: employeeIds } }, { userId: 1, courseId: 1, completed: 1 }).lean(),
    QuizAttempt.find({ userId: { $in: employeeIds } }, { userId: 1, courseId: 1, score: 1, passed: 1, status: 1, createdAt: 1 }).sort({ createdAt: -1 }).lean(),
  ])

  const now = new Date()
  const nowMs = now.getTime()
  const totalCourses = courses.length
  const courseMap = Object.fromEntries(courses.map(c => [String(c._id), c]))
  const nameMap = Object.fromEntries(employeeDocs.map(e => [String(e._id), e.name]))

  const people = employeeDocs.map(emp => {
    const id = String(emp._id)
    const completed = allProgress.filter(p => String(p.userId) === id && p.completed && courseMap[String(p.courseId)]).length
    return { id, done: totalCourses > 0 && completed >= totalCourses }
  })

  const submitted = allAttempts.filter(isSubmitted)
  const passedCount = submitted.filter(a => a.passed).length
  const passRate = submitted.length ? Math.round((passedCount / submitted.length) * 100) : 0
  const activeThisWeek = new Set(allAttempts.filter(a => nowMs - new Date(a.createdAt).getTime() < 7 * 86400000).map(a => String(a.userId))).size

  const stats = [
    { label: 'Employees', value: people.length, sub: `${activeThisWeek} active this week`, icon: Users, href: '/admin/employees' },
    { label: 'Training days', value: totalCourses, sub: 'in the programme', icon: BookOpen, href: '/admin/courses' },
    { label: 'Quizzes passed', value: passedCount, sub: `${passRate}% pass rate`, icon: CheckCircle2, href: '/admin/analytics' },
    { label: 'Training complete', value: people.filter(p => p.done).length, sub: `of ${people.length} employees`, icon: Trophy, href: '/admin/analytics' },
  ]

  const recent = allAttempts.slice(0, 6).map(a => ({
    id: String(a._id),
    userId: String(a.userId),
    name: nameMap[String(a.userId)] ?? 'Unknown',
    course: courseMap[String(a.courseId)],
    score: a.score,
    passed: a.passed,
    submitted: isSubmitted(a),
    when: timeAgo(a.createdAt, nowMs),
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' })}
        title={`${greeting(now)}, ${admin.name?.split(' ')[0] ?? 'Admin'}`}
        subtitle="Here's how your team's training is going"
        actions={<>
          <Link href="/admin/employees" className={bandButtonGhost}><UserPlus className="h-4 w-4" /> Add employee</Link>
          <Link href="/admin/announcements" className={bandButton}><Megaphone className="h-4 w-4" /> New announcement</Link>
        </>}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(s => (
          <Link
            key={s.label}
            href={s.href}
            className="group rounded-2xl border border-zinc-200 bg-white p-5 transition-all duration-200 hover:border-red-200 hover:shadow-md"
          >
            <div className="flex items-center justify-between text-zinc-400">
              <s.icon className="h-5 w-5 transition-colors group-hover:text-red-800" />
              <ArrowUpRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-4 text-3xl font-semibold text-zinc-900">{s.value}</p>
            <p className="mt-0.5 text-sm text-zinc-600">{s.label}</p>
            <p className="mt-2 text-xs text-zinc-400">{s.sub}</p>
          </Link>
        ))}
      </div>

      {/* Recent attempts */}
      <section className="rounded-2xl border border-zinc-200 bg-white">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="font-semibold text-zinc-900">Recent quiz attempts</h2>
            <Link href="/admin/analytics" className="inline-flex items-center text-xs font-medium text-zinc-500 hover:text-red-800">
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="px-5 pb-8 pt-2 text-center text-sm text-zinc-400">No attempts yet</p>
          ) : (
            <ul className="border-t border-zinc-100">
              {recent.map(a => (
                <li key={a.id}>
                  <Link href={`/admin/analytics/${a.userId}`} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-zinc-50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900">{a.name}</p>
                      <p className="truncate text-xs text-zinc-400">Day {a.course?.dayNumber ?? '?'} · {a.course?.title ?? 'Removed day'}</p>
                    </div>
                    <span className="hidden text-xs text-zinc-400 sm:block">{a.when}</span>
                    <span className="w-20 text-right text-sm font-semibold">
                      {!a.submitted
                        ? <span className="text-xs font-medium text-zinc-400">In progress</span>
                        : <span className={a.passed ? 'text-green-600' : 'text-red-800'}>{a.score}%</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
    </div>
  )
}
