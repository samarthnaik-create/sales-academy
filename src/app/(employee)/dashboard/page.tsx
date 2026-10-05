import { requireUser } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { Course } from '@/models/Course'
import { Progress } from '@/models/Progress'
import { User } from '@/models/User'
import { QuizAttempt } from '@/models/QuizAttempt'
import { Announcement } from '@/models/Announcement'
import Link from 'next/link'
import { Trophy, Medal, ArrowRight } from 'lucide-react'
import { CourseSearch } from '@/components/employee/course-search'

interface TopicGroup { title: string; modules: { title: string }[] }

function resolvePosition(content: string | null, topicIdx: number, moduleIdx: number): string {
  if (!content) return ''
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed) && parsed.length > 0) {
      if ('modules' in parsed[0]) {
        const topic = (parsed as TopicGroup[])[topicIdx]
        const mod = topic?.modules?.[moduleIdx]
        return [topic?.title, mod?.title].filter(Boolean).join(' › ')
      }
      if ('html' in parsed[0]) {
        const mod = (parsed as { title: string }[])[moduleIdx]
        return mod?.title ?? ''
      }
    }
  } catch {}
  return ''
}

export default async function DashboardPage() {
  const user = await requireUser()

  await connectDB()

  const [courses, progressList, employees, announcements, resumeProgressDoc] = await Promise.all([
    Course.find().sort({ dayNumber: 1 }).lean(),
    Progress.find({ userId: user.id }).lean(),
    User.find({ role: 'employee' }).lean(),
    Announcement.find({
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    }).sort({ createdAt: -1 }).limit(3).lean(),
    Progress.findOne({ userId: user.id, lastVisited: { $ne: null } })
      .sort({ lastVisited: -1 }).lean(),
  ])

  // Fetch resume course if we have a resume progress doc
  const resumeCourse = resumeProgressDoc
    ? await Course.findById(resumeProgressDoc.courseId, { dayNumber: 1, title: 1, content: 1 }).lean()
    : null

  const resumeProgress = resumeProgressDoc && resumeCourse ? {
    lastTopicIdx: resumeProgressDoc.lastTopicIdx,
    lastModuleIdx: resumeProgressDoc.lastModuleIdx,
    course: {
      dayNumber: resumeCourse.dayNumber,
      title: resumeCourse.title,
      content: resumeCourse.content ?? null,
    },
  } : null

  // Build progress map keyed by string courseId
  const progressMap = Object.fromEntries(
    progressList.map(p => [String(p.courseId), {
      unlocked: p.unlocked,
      completed: p.completed,
      score: p.score,
      attempts: p.attempts,
    }])
  )

  const completed = progressList.filter(p => p.completed).length
  const total = courses.length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  const allDone = pct === 100 && total > 0

  // Resume info
  const resumePosition = resumeProgress
    ? resolvePosition(resumeProgress.course?.content ?? null, resumeProgress.lastTopicIdx, resumeProgress.lastModuleIdx)
    : null

  // Leaderboard: fetch all progress and attempts for employees
  const empIds = employees.map(e => e._id)
  const [allEmpProgress, allEmpAttempts] = await Promise.all([
    Progress.find({ userId: { $in: empIds } }).lean(),
    QuizAttempt.find({ userId: { $in: empIds } }).lean(),
  ])

  const progressByEmp: Record<string, typeof allEmpProgress> = {}
  for (const p of allEmpProgress) {
    const uid = String(p.userId)
    if (!progressByEmp[uid]) progressByEmp[uid] = []
    progressByEmp[uid].push(p)
  }

  const attemptsByEmp: Record<string, typeof allEmpAttempts> = {}
  for (const a of allEmpAttempts) {
    const uid = String(a.userId)
    if (!attemptsByEmp[uid]) attemptsByEmp[uid] = []
    attemptsByEmp[uid].push(a)
  }

  const leaderboard = employees
    .map(emp => {
      const empId = String(emp._id)
      const empProgress = progressByEmp[empId] || []
      const empAttempts = attemptsByEmp[empId] || []
      const done = empProgress.filter(p => p.completed).length
      const empPct = total > 0 ? Math.round((done / total) * 100) : 0
      const scores = empAttempts.map(a => a.score)
      const avgScore = scores.length ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length) : 0
      return { id: empId, name: emp.name, pct: empPct, done, avgScore }
    })
    .sort((a, b) => b.pct - a.pct || b.avgScore - a.avgScore)
    .slice(0, 5)

  const myRank = leaderboard.findIndex(e => e.id === user.id) + 1

  // Map courses for CourseSearch
  const coursesForSearch = courses.map(c => ({
    id: String(c._id),
    title: c.title,
    description: c.description ?? null,
    dayNumber: c.dayNumber,
  }))

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Welcome back, {user.name?.split(' ')[0]} 👋</h1>
        <p className="text-zinc-500 text-sm mt-1">Continue your sales training journey</p>
      </div>

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="space-y-2 mb-6">
          {announcements.map(a => (
            <div key={String(a._id)} className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
              <span className="text-amber-500 text-base mt-0.5">📢</span>
              <div>
                <p className="text-sm font-semibold text-amber-900">{a.title}</p>
                {a.body && <p className="text-xs text-amber-700 mt-0.5">{a.body}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resume banner */}
      {resumeProgress?.course && !allDone && (
        <Link href={`/day/${resumeProgress.course.dayNumber}`}
          className="flex items-center justify-between bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl px-5 py-4 mb-6 group transition-colors">
          <div>
            <p className="text-xs text-zinc-400 font-medium mb-0.5">Continue where you left off</p>
            <p className="font-semibold text-sm">Day {resumeProgress.course.dayNumber} · {resumeProgress.course.title}</p>
            {resumePosition && <p className="text-xs text-zinc-400 mt-0.5">{resumePosition}</p>}
          </div>
          <ArrowRight className="h-5 w-5 text-zinc-400 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
        </Link>
      )}

      {/* Progress banner */}
      {allDone ? (
        <div className="bg-green-600 rounded-2xl p-6 mb-8 text-white text-center">
          <Trophy className="h-10 w-10 mx-auto mb-3 text-green-200" />
          <h2 className="text-xl font-bold mb-1">Training Complete!</h2>
          <p className="text-green-100 text-sm">You have completed all {total} days of the Sales Academy.</p>
          {myRank > 0 && <p className="text-green-200 text-xs mt-2">You are ranked #{myRank} on the leaderboard</p>}
        </div>
      ) : (
        <div className="bg-red-600 rounded-2xl p-6 mb-8 text-white">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-red-100 text-sm font-medium">Overall Progress</p>
              <p className="text-3xl font-bold mt-0.5">{pct}%</p>
            </div>
            <div className="text-right">
              <p className="text-red-100 text-sm">{completed} of {total} days</p>
              <p className="text-red-200 text-xs mt-0.5">completed</p>
            </div>
          </div>
          <div className="h-2 bg-red-500/50 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Day grid with search */}
        <div className="lg:col-span-2">
          {total === 0 ? (
            <div className="text-center py-16 text-zinc-400">
              <p className="text-lg font-medium">No courses yet</p>
              <p className="text-sm mt-1">Your admin will add courses soon.</p>
            </div>
          ) : (
            <CourseSearch courses={coursesForSearch} progressMap={progressMap} />
          )}
        </div>

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <div className="bg-white rounded-xl border border-zinc-200 p-5 h-fit">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="h-4 w-4 text-amber-500" />
              <h2 className="font-semibold text-sm text-zinc-900">Leaderboard</h2>
            </div>
            <div className="space-y-3">
              {leaderboard.map((emp, i) => {
                const isMe = emp.id === user.id
                const medals = ['🥇', '🥈', '🥉']
                return (
                  <div key={emp.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${isMe ? 'bg-red-50 border border-red-100' : ''}`}>
                    <span className="text-base w-6 text-center shrink-0">
                      {i < 3 ? medals[i] : <Medal className="h-4 w-4 text-zinc-300 mx-auto" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isMe ? 'text-red-700' : 'text-zinc-900'}`}>
                        {emp.name.split(' ')[0]}{isMe ? ' (You)' : ''}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="h-1 flex-1 bg-zinc-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${emp.pct === 100 ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${emp.pct}%` }} />
                        </div>
                        <span className="text-xs text-zinc-400 shrink-0">{emp.pct}%</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
