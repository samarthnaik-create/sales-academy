export const dynamic = 'force-dynamic'

import { requireAdmin } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { User } from '@/models/User'
import { Course } from '@/models/Course'
import { QuizAttempt, isSubmitted } from '@/models/QuizAttempt'
import { Progress } from '@/models/Progress'
import { computeQuizWindow, trainingFinishedAt, nextIncompleteDay, formatDuration } from '@/lib/quiz-window'
import Link from 'next/link'
import {
  Users, BookOpen, CheckCircle2, Trophy, ArrowUpRight, UserPlus, Megaphone, BarChart2,
  AlertTriangle, Clock, ChevronRight, PartyPopper,
} from 'lucide-react'

const ACCENTS = {
  blue: { bar: 'from-blue-500 to-sky-400', icon: 'bg-blue-50 text-blue-600', hover: 'hover:border-blue-300', text: 'text-blue-600' },
  violet: { bar: 'from-violet-500 to-fuchsia-400', icon: 'bg-violet-50 text-violet-600', hover: 'hover:border-violet-300', text: 'text-violet-600' },
  green: { bar: 'from-emerald-500 to-green-400', icon: 'bg-emerald-50 text-emerald-600', hover: 'hover:border-emerald-300', text: 'text-emerald-600' },
  amber: { bar: 'from-amber-500 to-yellow-400', icon: 'bg-amber-50 text-amber-600', hover: 'hover:border-amber-300', text: 'text-amber-600' },
}

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

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()

export default async function AdminPage() {
  const admin = await requireAdmin()
  await connectDB()

  const [employeeDocs, courses] = await Promise.all([
    User.find({ role: 'employee' }, { name: 1 }).lean(),
    Course.find({}, { title: 1, dayNumber: 1 }).sort({ dayNumber: 1 }).lean(),
  ])
  const employeeIds = employeeDocs.map(e => e._id)
  const [allProgress, allAttempts] = await Promise.all([
    Progress.find({ userId: { $in: employeeIds } }, { userId: 1, courseId: 1, completed: 1, completedAt: 1 }).lean(),
    QuizAttempt.find({ userId: { $in: employeeIds } }, { userId: 1, courseId: 1, score: 1, passed: 1, status: 1, createdAt: 1 }).sort({ createdAt: -1 }).lean(),
  ])

  const now = new Date()
  const nowMs = now.getTime()
  const totalCourses = courses.length
  const courseMap = Object.fromEntries(courses.map(c => [String(c._id), c]))
  const nameMap = Object.fromEntries(employeeDocs.map(e => [String(e._id), e.name]))

  // Per-employee status
  const people = employeeDocs.map(emp => {
    const id = String(emp._id)
    const progress = allProgress.filter(p => String(p.userId) === id)
    const attempts = allAttempts.filter(a => String(a.userId) === id)
    const completed = progress.filter(p => p.completed && courseMap[String(p.courseId)]).length
    const quizWindow = computeQuizWindow(attempts.map(a => a.createdAt), trainingFinishedAt(progress, totalCourses), now)
    return {
      id, name: emp.name, completed, attempts: attempts.length,
      done: totalCourses > 0 && completed >= totalCourses,
      overdueMs: quizWindow.overdueMs,
      nextDay: nextIncompleteDay(courses, progress),
    }
  })

  const submitted = allAttempts.filter(isSubmitted)
  const passedCount = submitted.filter(a => a.passed).length
  const passRate = submitted.length ? Math.round((passedCount / submitted.length) * 100) : 0
  const finished = people.filter(p => p.done).length
  const activeThisWeek = new Set(allAttempts.filter(a => nowMs - new Date(a.createdAt).getTime() < 7 * 86400000).map(a => String(a.userId))).size
  const overallPct = people.length && totalCourses
    ? Math.round(people.reduce((s, p) => s + Math.min(p.completed, totalCourses), 0) / (people.length * totalCourses) * 100)
    : 0

  const overdue = people.filter(p => p.overdueMs > 0).sort((a, b) => b.overdueMs - a.overdueMs)
  const notStarted = people.filter(p => p.attempts === 0)

  const stats = [
    { label: 'Employees', value: people.length, sub: `${activeThisWeek} active this week`, icon: Users, href: '/admin/employees', accent: ACCENTS.blue },
    { label: 'Training Days', value: totalCourses, sub: 'in the programme', icon: BookOpen, href: '/admin/courses', accent: ACCENTS.violet },
    { label: 'Quizzes Passed', value: passedCount, sub: `${passRate}% pass rate`, icon: CheckCircle2, href: '/admin/analytics', accent: ACCENTS.green },
    { label: 'Training Complete', value: finished, sub: `of ${people.length} employees`, icon: Trophy, href: '/admin/analytics', accent: ACCENTS.amber },
  ]

  const recent = allAttempts.slice(0, 8).map(a => ({
    id: String(a._id),
    userId: String(a.userId),
    name: nameMap[String(a.userId)] ?? 'Unknown',
    course: courseMap[String(a.courseId)],
    score: a.score,
    passed: a.passed,
    submitted: isSubmitted(a),
    when: timeAgo(a.createdAt, nowMs),
  }))

  const quickActions = [
    { label: 'Add employee', href: '/admin/employees', icon: UserPlus },
    { label: 'New announcement', href: '/admin/announcements', icon: Megaphone },
    { label: 'View analytics', href: '/admin/analytics', icon: BarChart2 },
  ]

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-600 via-red-600 to-rose-700 px-7 py-6 text-white shadow-lg shadow-red-600/20">
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute right-24 -bottom-20 h-40 w-40 rounded-full bg-white/5" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-red-100">
              {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' })}
            </p>
            <h1 className="mt-1 text-2xl font-bold">{greeting(now)}, {admin.name?.split(' ')[0] ?? 'Admin'}</h1>
            <p className="mt-1 text-sm text-red-100">
              Your team is <span className="font-semibold text-white">{overallPct}%</span> through the training
              {overdue.length > 0 && <> · <span className="font-semibold text-white">{overdue.length} overdue</span></>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickActions.map(a => (
              <Link
                key={a.label}
                href={a.href}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white hover:text-red-700"
              >
                <a.icon className="h-4 w-4" /> {a.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(s => (
          <Link
            key={s.label}
            href={s.href}
            className={`group relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${s.accent.hover}`}
          >
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${s.accent.bar}`} />
            <div className="flex items-center justify-between">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.accent.icon} transition-transform duration-200 group-hover:scale-110`}>
                <s.icon className="h-5 w-5" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-zinc-300 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zinc-500" />
            </div>
            <p className="mt-4 text-3xl font-bold text-zinc-900">{s.value}</p>
            <p className="text-sm font-medium text-zinc-600">{s.label}</p>
            <p className={`mt-1 text-xs font-medium ${s.accent.text}`}>{s.sub}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent attempts */}
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white lg:col-span-2">
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
            <div>
              <h2 className="font-semibold text-zinc-900">Recent Quiz Attempts</h2>
              <p className="text-xs text-zinc-400">Latest activity across your team</p>
            </div>
            <Link href="/admin/analytics" className="inline-flex items-center gap-0.5 text-xs font-medium text-red-600 hover:text-red-700">
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-zinc-400">No attempts yet</div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {recent.map(a => {
                const tone = !a.submitted ? 'amber' : a.passed ? 'green' : 'red'
                return (
                  <Link
                    key={a.id}
                    href={`/admin/analytics/${a.userId}`}
                    className={`group flex items-center gap-3 border-l-4 px-5 py-3 transition-colors hover:bg-zinc-50 ${
                      tone === 'green' ? 'border-l-emerald-400' : tone === 'red' ? 'border-l-red-400' : 'border-l-amber-400'
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-600 transition-colors group-hover:bg-red-50 group-hover:text-red-600">
                      {initials(a.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900">{a.name}</p>
                      <p className="truncate text-xs text-zinc-400">
                        Day {a.course?.dayNumber ?? '?'} · {a.course?.title ?? 'Removed day'}
                      </p>
                    </div>
                    <span className="hidden shrink-0 items-center gap-1 text-xs text-zinc-400 sm:inline-flex">
                      <Clock className="h-3 w-3" /> {a.when}
                    </span>
                    {a.submitted ? (
                      <span className={`w-[7.5rem] shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-center text-xs font-semibold ${
                        a.passed ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-red-50 text-red-600 ring-1 ring-red-200'
                      }`}>
                        {a.score}% · {a.passed ? 'Passed' : 'Failed'}
                      </span>
                    ) : (
                      <span className="w-[7.5rem] shrink-0 whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-center text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                        In progress
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Needs attention */}
          <div className="overflow-hidden rounded-xl border border-zinc-200 border-t-4 border-t-red-500 bg-white">
            <div className="flex items-center gap-2 px-5 pt-4 pb-3">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <h2 className="font-semibold text-zinc-900">Needs Attention</h2>
            </div>
            {overdue.length === 0 && notStarted.length === 0 ? (
              <div className="flex flex-col items-center px-5 pb-6 pt-2 text-center">
                <PartyPopper className="mb-2 h-8 w-8 text-emerald-500" />
                <p className="text-sm font-medium text-zinc-700">Everyone is on track</p>
                <p className="text-xs text-zinc-400">No overdue quizzes</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 pb-1">
                {overdue.slice(0, 5).map(p => (
                  <Link key={p.id} href={`/admin/analytics/${p.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 transition-colors hover:bg-red-50/60">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-900">{p.name}</p>
                      <p className="text-xs text-zinc-400">Day {p.nextDay ?? '?'} quiz</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
                      {formatDuration(p.overdueMs)} late
                    </span>
                  </Link>
                ))}
                {notStarted.slice(0, 5).map(p => (
                  <Link key={p.id} href={`/admin/analytics/${p.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 transition-colors hover:bg-zinc-50">
                    <p className="truncate text-sm font-medium text-zinc-900">{p.name}</p>
                    <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">Not started</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Team progress */}
          <div className="rounded-xl border border-zinc-200 border-t-4 border-t-blue-500 bg-white px-5 py-4">
            <h2 className="font-semibold text-zinc-900">Team Progress</h2>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-3xl font-bold text-zinc-900">{overallPct}%</p>
              <p className="text-xs text-zinc-400">of all days completed</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-sky-400" style={{ width: `${overallPct}%` }} />
            </div>
            <div className="mt-4 space-y-2.5">
              {people
                .slice()
                .sort((a, b) => b.completed - a.completed)
                .slice(0, 6)
                .map(p => {
                  const pct = totalCourses ? Math.round((Math.min(p.completed, totalCourses) / totalCourses) * 100) : 0
                  return (
                    <Link key={p.id} href={`/admin/analytics/${p.id}`} className="group block">
                      <div className="flex items-center justify-between text-xs">
                        <span className="truncate font-medium text-zinc-700 group-hover:text-red-600">{p.name}</span>
                        <span className="shrink-0 text-zinc-400">{Math.min(p.completed, totalCourses)}/{totalCourses}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className={`h-full rounded-full transition-all ${p.done ? 'bg-emerald-500' : 'bg-red-500 group-hover:bg-red-600'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </Link>
                  )
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
