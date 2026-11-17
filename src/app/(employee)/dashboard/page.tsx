export const dynamic = 'force-dynamic'

import { requireUser } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { Course } from '@/models/Course'
import { Progress } from '@/models/Progress'
import { Announcement } from '@/models/Announcement'
import { QuizAttempt } from '@/models/QuizAttempt'
import { computeQuizWindow, trainingFinishedAt, nextIncompleteDay, formatDuration, WINDOW_HOURS } from '@/lib/quiz-window'
import Link from 'next/link'
import { Clock, AlertTriangle, Megaphone } from 'lucide-react'
import { DashboardHome, type DayCard } from '@/components/employee/dashboard-home'
import { computeUnlocked } from '@/lib/unlock'

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

  const [courses, progressList, announcements, resumeProgressDoc, attempts] = await Promise.all([
    Course.find().sort({ dayNumber: 1 }).lean(),
    Progress.find({ userId: user.id }).lean(),
    Announcement.find({
      $and: [
        { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] },
        // Sent to everyone, or to a list that includes this employee
        { $or: [{ audience: { $exists: false } }, { audience: { $size: 0 } }, { audience: user.id }] },
      ],
    }).sort({ createdAt: -1 }).limit(3).lean(),
    Progress.findOne({ userId: user.id, lastVisited: { $ne: null } })
      .sort({ lastVisited: -1 }).lean(),
    QuizAttempt.find({ userId: user.id }, { createdAt: 1 }).lean(),
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

  const progressMap = Object.fromEntries(progressList.map(p => [String(p.courseId), p]))
  const unlockInput = Object.fromEntries(progressList.map(p => [String(p.courseId), { unlocked: p.unlocked, completed: p.completed, score: p.score }]))
  const courseRefs = courses.map(c => ({ id: String(c._id), dayNumber: c.dayNumber }))

  const days: DayCard[] = courses.map(c => {
    const id = String(c._id)
    const p = progressMap[id]
    return {
      id,
      dayNumber: c.dayNumber,
      title: c.title,
      description: c.description ?? null,
      unlocked: computeUnlocked(id, c.dayNumber, unlockInput, courseRefs),
      completed: !!p?.completed,
      score: p?.score ?? 0,
      attempts: p?.attempts ?? 0,
      visited: !!p?.lastVisited,
    }
  })

  const total = courses.length
  const completed = days.filter(d => d.completed).length
  const allDone = total > 0 && completed >= total

  // WINDOW_HOURS window to attempt the next quiz, restarted by every attempt
  const quizWindow = computeQuizWindow(attempts.map(a => a.createdAt), trainingFinishedAt(progressList, total))
  const nextDay = nextIncompleteDay(courses, progressList)

  const resume = resumeProgress?.course ? {
    dayNumber: resumeProgress.course.dayNumber,
    title: resumeProgress.course.title,
    position: resolvePosition(resumeProgress.course.content, resumeProgress.lastTopicIdx, resumeProgress.lastModuleIdx) || null,
  } : null

  return (
    <DashboardHome firstName={user.name?.split(' ')[0] ?? 'there'} completed={completed} total={total} resume={resume} days={days}>
      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="space-y-2">
          {announcements.map(a => (
            <div key={String(a._id)} className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3">
              <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-red-800" />
              <div>
                <p className="text-sm font-semibold text-zinc-900">{a.title}</p>
                {a.body && <p className="mt-0.5 whitespace-pre-line text-sm text-zinc-500">{a.body}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quiz deadline */}
      {!allDone && quizWindow.deadline && nextDay && (
        quizWindow.overdueMs > 0 ? (
          <Link href={`/day/${nextDay}`} className="flex items-start gap-3 rounded-xl border border-red-100 bg-white px-4 py-3 transition-colors hover:bg-red-50/50">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
            <div>
              <p className="text-sm font-semibold text-red-800">Day {nextDay} quiz is overdue by {formatDuration(quizWindow.overdueMs)}</p>
              <p className="mt-0.5 text-xs text-zinc-500">Attempt it as soon as possible. Your admin can see missed deadlines.</p>
            </div>
          </Link>
        ) : (
          <Link href={`/day/${nextDay}`} className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 transition-colors hover:bg-zinc-50">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
            <div>
              <p className="text-sm font-semibold text-zinc-900">Attempt your Day {nextDay} quiz within {formatDuration(quizWindow.remainingMs)}</p>
              <p className="mt-0.5 text-xs text-zinc-500">You have {WINDOW_HOURS} hours after each quiz attempt to attempt the next one. Passing or not, any attempt resets the clock.</p>
            </div>
          </Link>
        )
      )}
    </DashboardHome>
  )
}
