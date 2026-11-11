export const dynamic = 'force-dynamic'

import mongoose from 'mongoose'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { User } from '@/models/User'
import { Course } from '@/models/Course'
import { Progress } from '@/models/Progress'
import { QuizAttempt, isSubmitted } from '@/models/QuizAttempt'
import { MAX_TAB_SWITCHES } from '@/lib/quiz-config'
import {
  computeQuizWindow, trainingFinishedAt, nextIncompleteDay, attemptLateness, formatDuration, WINDOW_HOURS,
} from '@/lib/quiz-window'
import { ArrowLeft, AlertCircle, Trophy, CheckCircle2, Clock, Lock } from 'lucide-react'

interface Props { params: Promise<{ userId: string }> }

const IST = 'Asia/Kolkata'
const fmtDate = (d: Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-GB', { timeZone: IST, day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const fmtDateTime = (d: Date) =>
  new Date(d).toLocaleString('en-GB', { timeZone: IST, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })

function scoreColor(score: number | null) {
  if (score === null) return 'text-zinc-300'
  if (score >= 90) return 'text-green-600'
  if (score >= 60) return 'text-amber-500'
  return 'text-red-500'
}

export default async function EmployeeAnalyticsPage({ params }: Props) {
  await requireAdmin()
  const { userId } = await params
  if (!mongoose.isValidObjectId(userId)) notFound()

  await connectDB()
  const emp = await User.findOne({ _id: userId, role: 'employee' }).lean()
  if (!emp) notFound()

  const [courses, progressList, attempts] = await Promise.all([
    Course.find({}, { title: 1, dayNumber: 1 }).sort({ dayNumber: 1 }).lean(),
    Progress.find({ userId }).lean(),
    QuizAttempt.find({ userId }, { courseId: 1, score: 1, passed: 1, tabSwitches: 1, status: 1, exited: 1, createdAt: 1 }).sort({ createdAt: 1 }).lean(),
  ])

  const totalCourses = courses.length
  const finishedAt = trainingFinishedAt(progressList, totalCourses)
  const quizWindow = computeQuizWindow(attempts.map(a => a.createdAt), finishedAt)
  const lateness = attemptLateness(attempts.map(a => a.createdAt), finishedAt)
  const nextDay = nextIncompleteDay(courses, progressList)
  const courseById = Object.fromEntries(courses.map(c => [String(c._id), c]))
  const progressByCourse = Object.fromEntries(progressList.map(p => [String(p.courseId), p]))

  const completedCount = progressList.filter(p => p.completed).length
  const pct = totalCourses ? Math.round((completedCount / totalCourses) * 100) : 0
  const scores = attempts.filter(isSubmitted).map(a => a.score)
  const unfinished = attempts.length - scores.length
  const avgScore = scores.length ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length) : null
  const tabSwitches = attempts.reduce((s, a) => s + (a.tabSwitches ?? 0), 0)

  // Per-day breakdown
  const days = courses.map(course => {
    const cid = String(course._id)
    const p = progressByCourse[cid]
    const dayAttempts = attempts.map((a, i) => ({ ...a, late: lateness[i] })).filter(a => String(a.courseId) === cid)
    const firstPass = dayAttempts.findIndex(a => a.passed)
    const completed = Boolean(p?.completed)
    const completedOn = completed ? (p?.completedAt ?? dayAttempts[firstPass]?.createdAt ?? null) : null
    const unlocked = course.dayNumber === 1 || Boolean(p?.unlocked) || completed
    const lateAttempts = dayAttempts.filter(a => a.late > 0)
    const daySubmitted = dayAttempts.filter(isSubmitted)
    return {
      id: cid,
      dayNumber: course.dayNumber,
      title: course.title,
      completed,
      completedOn,
      unlocked,
      firstAttempt: dayAttempts[0]?.createdAt ?? null,
      attempts: dayAttempts.length,
      passedOnAttempt: firstPass >= 0 ? firstPass + 1 : null,
      bestScore: daySubmitted.length ? Math.max(...daySubmitted.map(a => a.score)) : null,
      unfinished: dayAttempts.length - daySubmitted.length,
      lateCount: lateAttempts.length,
      maxLate: Math.max(0, ...lateAttempts.map(a => a.late)),
      tabSwitches: dayAttempts.reduce((s, a) => s + (a.tabSwitches ?? 0), 0),
      isCurrent: course.dayNumber === nextDay,
    }
  })

  const history = attempts.map((a, i) => ({ ...a, late: lateness[i], course: courseById[String(a.courseId)] })).reverse()

  const cards = [
    { label: 'Days completed', value: `${completedCount}/${totalCourses}` },
    { label: 'Avg quiz score', value: avgScore !== null ? `${avgScore}%` : '—', color: scoreColor(avgScore) },
    { label: unfinished ? `Quiz attempts (${unfinished} not submitted)` : 'Quiz attempts', value: attempts.length },
    { label: 'Missed windows', value: quizWindow.missed, color: quizWindow.missed ? 'text-amber-600' : undefined },
    { label: 'Tab switches', value: tabSwitches, color: tabSwitches ? 'text-amber-600' : undefined },
  ]

  return (
    <div className="max-w-5xl">
      <Link href="/admin/analytics" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors mb-5">
        <ArrowLeft className="h-4 w-4" /> Back to Analytics
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
          <span className="text-red-700 text-lg font-bold">{emp.name.trim().charAt(0)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-zinc-900">{emp.name}</h1>
          <p className="text-sm text-zinc-400">@{emp.username} · {emp.email} · joined {fmtDate(emp.createdAt)}</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-1.5 w-40 bg-zinc-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${pct === 100 ? 'bg-green-500' : 'bg-red-600'}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-zinc-500">{pct}% complete</span>
          </div>
        </div>
      </div>

      {/* Current status, same rules as the employee dashboard */}
      {finishedAt ? (
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-6">
          <Trophy className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-green-800">
            Training complete on {fmtDate(finishedAt)}
          </p>
        </div>
      ) : quizWindow.deadline && nextDay ? (
        quizWindow.overdueMs > 0 ? (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Overdue: Day {nextDay} quiz is {formatDuration(quizWindow.overdueMs)} late</p>
              <p className="text-xs text-red-700 mt-0.5">It was due by {fmtDateTime(quizWindow.deadline)} ({WINDOW_HOURS}h after the last attempt).</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 bg-white border border-zinc-200 rounded-xl px-4 py-3 mb-6">
            <Clock className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-zinc-900">On track: Day {nextDay} quiz due in {formatDuration(quizWindow.deadline.getTime() - Date.now())}</p>
              <p className="text-xs text-zinc-500 mt-0.5">Deadline {fmtDateTime(quizWindow.deadline)}.</p>
            </div>
          </div>
        )
      ) : (
        <div className="flex items-start gap-3 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 mb-6">
          <Clock className="h-4 w-4 text-zinc-400 shrink-0 mt-0.5" />
          <p className="text-sm text-zinc-500">Not started yet. The {WINDOW_HOURS}h clock starts after their first quiz attempt.</p>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {cards.map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-zinc-200 p-4">
            <p className={`text-2xl font-bold ${c.color ?? 'text-zinc-900'}`}>{c.value}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Day by day */}
      <div className="bg-white rounded-xl border border-zinc-200 mb-6">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-900">Day by Day</h2>
          <p className="text-xs text-zinc-400 mt-0.5">When each day was attempted and completed, with scores and attempts</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-5 py-3 font-medium text-zinc-500">Day</th>
                <th className="text-left px-5 py-3 font-medium text-zinc-500">Status</th>
                <th className="text-left px-5 py-3 font-medium text-zinc-500">First Attempt</th>
                <th className="text-left px-5 py-3 font-medium text-zinc-500">Completed On</th>
                <th className="text-left px-5 py-3 font-medium text-zinc-500">Best Score</th>
                <th className="text-left px-5 py-3 font-medium text-zinc-500">Attempts</th>
                <th className="text-left px-5 py-3 font-medium text-zinc-500">Timing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {days.map(d => (
                <tr key={d.id} className={d.unlocked ? '' : 'text-zinc-300'}>
                  <td className="px-5 py-3.5">
                    <p className={`font-medium ${d.unlocked ? 'text-zinc-900' : 'text-zinc-400'}`}>Day {d.dayNumber}</p>
                    <p className="text-xs text-zinc-400 max-w-[220px] truncate">{d.title}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    {d.completed ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full whitespace-nowrap">
                        <CheckCircle2 className="h-3 w-3" /> Completed
                      </span>
                    ) : d.isCurrent && quizWindow.overdueMs > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-1 rounded-full whitespace-nowrap">
                        <AlertCircle className="h-3 w-3" /> Overdue
                      </span>
                    ) : d.attempts > 0 ? (
                      <span className="text-xs font-medium text-amber-600 whitespace-nowrap">Not passed yet</span>
                    ) : d.unlocked ? (
                      <span className="text-xs font-medium text-blue-600 whitespace-nowrap">Not attempted</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-zinc-300 whitespace-nowrap"><Lock className="h-3 w-3" /> Locked</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-zinc-500 whitespace-nowrap">{fmtDate(d.firstAttempt)}</td>
                  <td className={`px-5 py-3.5 text-xs whitespace-nowrap ${d.completedOn ? 'font-semibold text-green-700' : 'text-zinc-300'}`}>{fmtDate(d.completedOn)}</td>
                  <td className={`px-5 py-3.5 font-semibold ${scoreColor(d.bestScore)}`}>{d.bestScore !== null ? `${d.bestScore}%` : '—'}</td>
                  <td className="px-5 py-3.5 text-zinc-500">
                    {d.attempts || '—'}
                    {d.passedOnAttempt && <p className="text-xs text-zinc-400 whitespace-nowrap">passed on #{d.passedOnAttempt}</p>}
                    {d.unfinished > 0 && <p className="text-xs text-amber-600 whitespace-nowrap">{d.unfinished} not submitted</p>}
                    {d.tabSwitches > 0 && <p className="text-xs text-amber-600 whitespace-nowrap">{d.tabSwitches} tab switch{d.tabSwitches > 1 ? 'es' : ''}</p>}
                  </td>
                  <td className="px-5 py-3.5 text-xs whitespace-nowrap">
                    {d.lateCount > 0
                      ? <span className="text-red-500">{d.lateCount} late · up to {formatDuration(d.maxLate)}</span>
                      : d.attempts > 0 ? <span className="text-green-600">On time</span> : <span className="text-zinc-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Attempt history */}
      <div className="bg-white rounded-xl border border-zinc-200 mb-6">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-900">Attempt History</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Every quiz attempt, newest first</p>
        </div>
        {history.length === 0 ? (
          <div className="px-5 py-10 text-center text-zinc-400 text-sm">No quiz attempts yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="text-left px-5 py-3 font-medium text-zinc-500">Date &amp; Time</th>
                  <th className="text-left px-5 py-3 font-medium text-zinc-500">Day</th>
                  <th className="text-left px-5 py-3 font-medium text-zinc-500">Score</th>
                  <th className="text-left px-5 py-3 font-medium text-zinc-500">Result</th>
                  <th className="text-left px-5 py-3 font-medium text-zinc-500">Tab Switches</th>
                  <th className="text-left px-5 py-3 font-medium text-zinc-500">Timing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {history.map(a => (
                  <tr key={String(a._id)}>
                    <td className="px-5 py-3 text-xs text-zinc-500 whitespace-nowrap">{fmtDateTime(a.createdAt)}</td>
                    <td className="px-5 py-3 text-zinc-700 whitespace-nowrap">{a.course ? `Day ${a.course.dayNumber}` : 'Deleted day'}</td>
                    {isSubmitted(a) ? (
                      <>
                        <td className={`px-5 py-3 font-semibold ${scoreColor(a.score)}`}>{a.score}%</td>
                        <td className="px-5 py-3">
                          {a.passed
                            ? <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">Passed</span>
                            : <span className="text-xs font-medium text-red-700 bg-red-50 px-2 py-1 rounded-full">Failed</span>}
                          {a.exited && <p className="text-xs text-amber-600 mt-1 whitespace-nowrap">left midway</p>}
                        </td>
                        <td className="px-5 py-3 text-xs">
                          <span className={(a.tabSwitches ?? 0) > 0 ? 'font-semibold text-amber-600' : 'text-zinc-400'}>{a.tabSwitches ?? 0}</span>
                          {(a.tabSwitches ?? 0) >= MAX_TAB_SWITCHES && <span className="text-red-500 ml-1.5">auto-submitted</span>}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-5 py-3 text-zinc-300">—</td>
                        <td className="px-5 py-3">
                          <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full whitespace-nowrap">Not submitted</span>
                        </td>
                        <td className="px-5 py-3 text-xs text-zinc-300">—</td>
                      </>
                    )}
                    <td className="px-5 py-3 text-xs whitespace-nowrap">
                      {a.late > 0 ? <span className="text-red-500">{formatDuration(a.late)} late</span> : <span className="text-green-600">On time</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
