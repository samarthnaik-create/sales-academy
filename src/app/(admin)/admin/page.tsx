export const dynamic = 'force-dynamic'

import { requireAdmin } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { User } from '@/models/User'
import { Course } from '@/models/Course'
import { QuizAttempt } from '@/models/QuizAttempt'
import { Certificate } from '@/models/Certificate'
import Link from 'next/link'
import { Users, BookOpen, CheckCircle2, Award } from 'lucide-react'

export default async function AdminPage() {
  await requireAdmin()

  await connectDB()

  const [employees, courses, passed, certs] = await Promise.all([
    User.countDocuments({ role: 'employee' }),
    Course.countDocuments(),
    QuizAttempt.countDocuments({ passed: true }),
    Certificate.countDocuments(),
  ])

  const stats = [
    { label: 'Employees', value: employees, icon: Users, href: '/admin/employees' },
    { label: 'Courses', value: courses, icon: BookOpen, href: '/admin/courses' },
    { label: 'Quizzes Passed', value: passed, icon: CheckCircle2, href: '/admin/employees' },
    { label: 'Certificates', value: certs, icon: Award, href: '/admin/employees' },
  ]

  const recentAttemptDocs = await QuizAttempt.find().sort({ createdAt: -1 }).limit(10).lean()

  // Fetch related user and course data
  const userIds = [...new Set(recentAttemptDocs.map(a => a.userId))]
  const courseIds = [...new Set(recentAttemptDocs.map(a => a.courseId))]
  const [users, courseList] = await Promise.all([
    User.find({ _id: { $in: userIds } }, { name: 1 }).lean(),
    Course.find({ _id: { $in: courseIds } }, { title: 1, dayNumber: 1 }).lean(),
  ])

  const userMap = Object.fromEntries(users.map(u => [String(u._id), u]))
  const courseMap = Object.fromEntries(courseList.map(c => [String(c._id), c]))

  const recentAttempts = recentAttemptDocs.map(a => ({
    id: String(a._id),
    score: a.score,
    passed: a.passed,
    user: userMap[String(a.userId)] ?? { name: 'Unknown' },
    course: courseMap[String(a.courseId)] ?? { title: 'Unknown', dayNumber: 0 },
  }))

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-1">Admin Dashboard</h1>
      <p className="text-zinc-500 text-sm mb-8">Overview of your Sales Academy</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(s => (
          <Link key={s.label} href={s.href} className="bg-white rounded-xl border border-zinc-200 p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center">
                <s.icon className="h-4 w-4 text-red-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-zinc-900">{s.value}</p>
            <p className="text-sm text-zinc-400 mt-0.5">{s.label}</p>
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-zinc-200">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-900">Recent Quiz Attempts</h2>
        </div>
        {recentAttempts.length === 0 ? (
          <div className="px-5 py-8 text-center text-zinc-400 text-sm">No attempts yet</div>
        ) : (
          <div className="divide-y divide-zinc-50">
            {recentAttempts.map(a => (
              <div key={a.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-900">{a.user.name}</p>
                  <p className="text-xs text-zinc-400">Day {a.course.dayNumber} · {a.course.title}</p>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-semibold ${a.passed ? 'text-green-600' : 'text-red-500'}`}>{a.score}%</span>
                  <p className="text-xs text-zinc-400">{a.passed ? 'Passed' : 'Failed'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
