export const dynamic = 'force-dynamic'

import { requireUser } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { Course } from '@/models/Course'
import { Progress } from '@/models/Progress'
import { Announcement } from '@/models/Announcement'
import Link from 'next/link'
import { Trophy, ArrowRight } from 'lucide-react'
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

  const [courses, progressList, announcements, resumeProgressDoc] = await Promise.all([
    Course.find().sort({ dayNumber: 1 }).lean(),
    Progress.find({ userId: user.id }).lean(),
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

      {total === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <p className="text-lg font-medium">No courses yet</p>
          <p className="text-sm mt-1">Your admin will add courses soon.</p>
        </div>
      ) : (
        <CourseSearch courses={coursesForSearch} progressMap={progressMap} />
      )}
    </div>
  )
}
