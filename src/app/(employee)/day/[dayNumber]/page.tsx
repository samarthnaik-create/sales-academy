export const dynamic = 'force-dynamic'

import { requireUser } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { Course } from '@/models/Course'
import { Progress } from '@/models/Progress'
import { Quiz } from '@/models/Quiz'
import { checkCourseAccess } from '@/lib/unlock'
import { clampQuestionCount, PASS_THRESHOLD } from '@/lib/quiz-config'
import { notFound, redirect } from 'next/navigation'
import { LessonViewer } from '@/components/employee/lesson-viewer'

interface Props { params: Promise<{ dayNumber: string }> }

// Day-level videos: the list (new) or the single legacy URL
function parseVideos(videos?: string | null, videoUrl?: string | null): { title: string; url: string }[] {
  let list: { title: string; url: string }[] = []
  if (videos) {
    try { const p = JSON.parse(videos); if (Array.isArray(p)) list = p } catch {}
  }
  if (list.length === 0 && videoUrl) list = [{ title: '', url: videoUrl }]
  return list.filter(v => typeof v?.url === 'string' && v.url.trim())
}

export default async function DayPage({ params }: Props) {
  const { dayNumber } = await params
  const user = await requireUser()

  await connectDB()

  const day = Number(dayNumber)
  if (!Number.isInteger(day) || day < 1) notFound()
  const courseDoc = await Course.findOne({ dayNumber: day }).lean()
  if (!courseDoc) notFound()

  const courseId = String(courseDoc._id)
  const [progressDoc, accessible, quizCount, nextCourse] = await Promise.all([
    Progress.findOne({ userId: user.id, courseId }).lean(),
    checkCourseAccess(user.id, courseId, courseDoc.dayNumber),
    Quiz.countDocuments({ courseId }),
    Course.exists({ dayNumber: courseDoc.dayNumber + 1 }),
  ])
  if (!accessible) redirect('/dashboard')

  const questionCount = courseDoc.aiTopup || quizCount === 0
    ? Math.max(clampQuestionCount(courseDoc.questionCount), quizCount)
    : quizCount

  return (
    <LessonViewer
      course={{
        id: courseId,
        dayNumber: courseDoc.dayNumber,
        title: courseDoc.title,
        description: courseDoc.description ?? null,
        content: courseDoc.content ?? null,
        videos: parseVideos(courseDoc.videos, courseDoc.videoUrl),
      }}
      quiz={{
        questionCount,
        passMark: PASS_THRESHOLD,
        completed: !!progressDoc?.completed,
        bestScore: progressDoc?.score ?? 0,
        attempts: progressDoc?.attempts ?? 0,
        hasNextDay: !!nextCourse,
      }}
      start={{
        topicIdx: progressDoc?.lastTopicIdx ?? 0,
        moduleIdx: progressDoc?.lastModuleIdx ?? 0,
        read: progressDoc?.readModules ?? [],
      }}
    />
  )
}
