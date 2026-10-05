import { requireAdmin } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { User } from '@/models/User'
import { Course } from '@/models/Course'
import { Progress } from '@/models/Progress'
import { QuizAttempt } from '@/models/QuizAttempt'
import { Certificate } from '@/models/Certificate'
import { Award, CheckCircle2, TrendingUp, Users, AlertCircle } from 'lucide-react'

export default async function AnalyticsPage() {
  await requireAdmin()

  await connectDB()

  const [employeeDocs, courses] = await Promise.all([
    User.find({ role: 'employee' }).sort({ createdAt: 1 }).lean(),
    Course.find().sort({ dayNumber: 1 }).lean(),
  ])

  const empIds = employeeDocs.map(e => e._id)
  const courseIds = courses.map(c => c._id)

  const [allProgress, allAttempts, allCerts, courseAttempts, courseProgress] = await Promise.all([
    Progress.find({ userId: { $in: empIds } }).lean(),
    QuizAttempt.find({ userId: { $in: empIds } }).sort({ createdAt: -1 }).lean(),
    Certificate.find({ userId: { $in: empIds } }).lean(),
    QuizAttempt.find({ courseId: { $in: courseIds } }).lean(),
    Progress.find({ courseId: { $in: courseIds } }).lean(),
  ])

  const totalCourses = courses.length

  // Group by employee
  const progressByEmp: Record<string, typeof allProgress> = {}
  for (const p of allProgress) {
    const uid = String(p.userId)
    if (!progressByEmp[uid]) progressByEmp[uid] = []
    progressByEmp[uid].push(p)
  }

  const attemptsByEmp: Record<string, typeof allAttempts> = {}
  for (const a of allAttempts) {
    const uid = String(a.userId)
    if (!attemptsByEmp[uid]) attemptsByEmp[uid] = []
    attemptsByEmp[uid].push(a)
  }

  const certByEmp = Object.fromEntries(allCerts.map(c => [String(c.userId), c]))

  // Group by course
  const attemptsByCourse: Record<string, typeof courseAttempts> = {}
  for (const a of courseAttempts) {
    const cid = String(a.courseId)
    if (!attemptsByCourse[cid]) attemptsByCourse[cid] = []
    attemptsByCourse[cid].push(a)
  }

  const progressByCourse: Record<string, typeof courseProgress> = {}
  for (const p of courseProgress) {
    const cid = String(p.courseId)
    if (!progressByCourse[cid]) progressByCourse[cid] = []
    progressByCourse[cid].push(p)
  }

  // Per-employee stats
  const empStats = employeeDocs.map(emp => {
    const empId = String(emp._id)
    const empProgress = progressByEmp[empId] || []
    const empAttempts = attemptsByEmp[empId] || []
    const completed = empProgress.filter(p => p.completed).length
    const pct = totalCourses > 0 ? Math.round((completed / totalCourses) * 100) : 0
    const scores = empAttempts.map(a => a.score)
    const avgScore = scores.length ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length) : null
    const bestScore = scores.length ? Math.max(...scores) : null
    const lastAttempt = empAttempts[0]?.createdAt ?? null
    const currentDay = empProgress.filter(p => p.unlocked).length

    return {
      emp: { id: empId, name: emp.name, username: emp.username, certificate: certByEmp[empId] ?? null },
      completed,
      pct,
      avgScore,
      bestScore,
      lastAttempt,
      currentDay,
      attempts: empAttempts.length,
    }
  })

  // Per-course stats
  const courseStats = courses.map(course => {
    const courseId = String(course._id)
    const attempts = attemptsByCourse[courseId] || []
    const progress = progressByCourse[courseId] || []
    const completions = progress.filter(p => p.completed).length
    const passedAttempts = attempts.filter(a => a.passed)
    const avgScore = attempts.length ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length) : null
    const passRate = attempts.length ? Math.round((passedAttempts.length / attempts.length) * 100) : null
    const unlocked = progress.filter(p => p.unlocked).length

    return {
      course: { id: courseId, title: course.title, dayNumber: course.dayNumber },
      completions,
      avgScore,
      passRate,
      totalAttempts: attempts.length,
      unlocked,
    }
  })

  // Summary stats
  const totalEmployees = employeeDocs.length
  const overallPct = empStats.length
    ? Math.round(empStats.reduce((s, e) => s + e.pct, 0) / empStats.length)
    : 0
  const allScores = allAttempts.map(a => a.score)
  const overallAvgScore = allScores.length ? Math.round(allScores.reduce((s, n) => s + n, 0) / allScores.length) : 0
  const certificates = allCerts.length
  const struggling = empStats.filter(e => e.pct < 50 && e.attempts > 0)

  const summaryCards = [
    { label: 'Total Employees', value: totalEmployees, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Avg Completion', value: `${overallPct}%`, icon: TrendingUp, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Avg Quiz Score', value: allScores.length ? `${overallAvgScore}%` : '—', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Certified', value: certificates, icon: Award, color: 'text-amber-600', bg: 'bg-amber-50' },
  ]

  function scoreColor(score: number | null) {
    if (score === null) return 'text-zinc-300'
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-amber-500'
    return 'text-red-500'
  }

  function formatDate(d: Date | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Analytics</h1>
        <p className="text-zinc-500 text-sm mt-1">Training progress and performance across your team</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {summaryCards.map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-zinc-200 p-5">
            <div className={`w-9 h-9 ${c.bg} rounded-lg flex items-center justify-center mb-3`}>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </div>
            <p className="text-3xl font-bold text-zinc-900">{c.value}</p>
            <p className="text-sm text-zinc-400 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Struggling employees alert */}
      {struggling.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-6 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {struggling.length} employee{struggling.length > 1 ? 's' : ''} need attention
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              {struggling.map(e => e.emp.name).join(', ')} — below 50% completion
            </p>
          </div>
        </div>
      )}

      {/* Employee breakdown */}
      <div className="bg-white rounded-xl border border-zinc-200 mb-6">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-900">Employee Progress</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Per-employee completion, scores and activity</p>
        </div>

        {empStats.length === 0 ? (
          <div className="px-5 py-10 text-center text-zinc-400 text-sm">No employees yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="text-left px-5 py-3 font-medium text-zinc-500">Employee</th>
                  <th className="text-left px-5 py-3 font-medium text-zinc-500">Progress</th>
                  <th className="text-left px-5 py-3 font-medium text-zinc-500">Avg Score</th>
                  <th className="text-left px-5 py-3 font-medium text-zinc-500">Best Score</th>
                  <th className="text-left px-5 py-3 font-medium text-zinc-500">Attempts</th>
                  <th className="text-left px-5 py-3 font-medium text-zinc-500">Last Active</th>
                  <th className="text-left px-5 py-3 font-medium text-zinc-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {empStats.map(({ emp, completed, pct, avgScore, bestScore, lastAttempt, attempts }) => (
                  <tr key={emp.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                          <span className="text-red-700 text-xs font-bold">{emp.name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="font-medium text-zinc-900">{emp.name}</p>
                          <p className="text-xs text-zinc-400">@{emp.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 bg-zinc-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct === 100 ? 'bg-green-500' : 'bg-red-600'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-zinc-500 shrink-0">{completed}/{totalCourses} days</span>
                      </div>
                    </td>
                    <td className={`px-5 py-3.5 font-semibold ${scoreColor(avgScore)}`}>
                      {avgScore !== null ? `${avgScore}%` : '—'}
                    </td>
                    <td className={`px-5 py-3.5 font-semibold ${scoreColor(bestScore)}`}>
                      {bestScore !== null ? `${bestScore}%` : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-zinc-500">{attempts}</td>
                    <td className="px-5 py-3.5 text-zinc-400 text-xs">{formatDate(lastAttempt)}</td>
                    <td className="px-5 py-3.5">
                      {emp.certificate ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                          <Award className="h-3 w-3" /> Certified
                        </span>
                      ) : pct === 100 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
                          <CheckCircle2 className="h-3 w-3" /> Complete
                        </span>
                      ) : attempts === 0 ? (
                        <span className="text-xs text-zinc-300">Not started</span>
                      ) : pct < 50 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                          <AlertCircle className="h-3 w-3" /> Needs help
                        </span>
                      ) : (
                        <span className="text-xs text-blue-600 font-medium">In progress</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Course breakdown */}
      <div className="bg-white rounded-xl border border-zinc-200">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-900">Course Performance</h2>
          <p className="text-xs text-zinc-400 mt-0.5">How employees are performing on each day</p>
        </div>

        {courseStats.length === 0 ? (
          <div className="px-5 py-10 text-center text-zinc-400 text-sm">No courses yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="text-left px-5 py-3 font-medium text-zinc-500">Course</th>
                  <th className="text-left px-5 py-3 font-medium text-zinc-500">Unlocked by</th>
                  <th className="text-left px-5 py-3 font-medium text-zinc-500">Completions</th>
                  <th className="text-left px-5 py-3 font-medium text-zinc-500">Avg Score</th>
                  <th className="text-left px-5 py-3 font-medium text-zinc-500">Pass Rate</th>
                  <th className="text-left px-5 py-3 font-medium text-zinc-500">Total Attempts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {courseStats.map(({ course, completions, avgScore, passRate, totalAttempts, unlocked }) => (
                  <tr key={course.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="font-medium text-zinc-900">{course.title}</p>
                        <p className="text-xs text-zinc-400">Day {course.dayNumber}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-zinc-500">{unlocked} / {totalEmployees}</td>
                    <td className="px-5 py-3.5 text-zinc-500">{completions} / {unlocked || '—'}</td>
                    <td className={`px-5 py-3.5 font-semibold ${scoreColor(avgScore)}`}>
                      {avgScore !== null ? `${avgScore}%` : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      {passRate !== null ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 bg-zinc-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${passRate >= 80 ? 'bg-green-500' : passRate >= 50 ? 'bg-amber-400' : 'bg-red-500'}`}
                              style={{ width: `${passRate}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-500">{passRate}%</span>
                        </div>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-zinc-500">{totalAttempts}</td>
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
