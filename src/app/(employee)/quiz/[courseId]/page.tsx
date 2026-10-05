import { requireUser } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { Course } from '@/models/Course'
import { Quiz } from '@/models/Quiz'
import { Progress } from '@/models/Progress'
import { checkCourseAccess } from '@/lib/unlock'
import { notFound, redirect } from 'next/navigation'
import { QuizEngine } from '@/components/employee/quiz-engine'
import { AiQuizStarter } from '@/components/employee/ai-quiz-starter'

interface Props { params: Promise<{ courseId: string }> }

export default async function QuizPage({ params }: Props) {
  const { courseId } = await params
  const user = await requireUser()

  await connectDB()

  const courseDoc = await Course.findById(courseId).lean()
  if (!courseDoc) notFound()

  const quizDocs = await Quiz.find({ courseId }).sort({ order: 1 }).lean()
  const quizzes = quizDocs.map(q => ({
    id: String(q._id),
    question: q.question,
    options: q.options,
    answer: q.answer,
    order: q.order,
  }))

  const course = {
    id: courseId,
    title: courseDoc.title,
    description: courseDoc.description ?? null,
    dayNumber: courseDoc.dayNumber,
    videoUrl: courseDoc.videoUrl ?? null,
    videos: courseDoc.videos ?? null,
    content: courseDoc.content ?? null,
    aiTopup: courseDoc.aiTopup,
    quizzes,
  }

  const [progressDoc, nextCourseDoc, accessible] = await Promise.all([
    Progress.findOne({ userId: user.id, courseId }).lean(),
    Course.findOne({ dayNumber: courseDoc.dayNumber + 1 }, { _id: 1 }).lean(),
    checkCourseAccess(user.id, courseId, courseDoc.dayNumber),
  ])
  if (!accessible) redirect('/dashboard')

  const hasNextDay = !!nextCourseDoc

  // AI top-up or pure AI — route through generate API (handles hybrid + shuffle)
  const safeProgress = progressDoc ? { attempts: progressDoc.attempts, score: progressDoc.score } : { attempts: 0, score: 0 }

  if (course.aiTopup || course.quizzes.length === 0) {
    return <AiQuizStarter course={course} progress={safeProgress} userId={user.id} hasNextDay={hasNextDay} />
  }

  // Pure manual questions — shuffle them here
  const shuffled = [...course.quizzes].sort(() => Math.random() - 0.5)

  return (
    <QuizEngine
      course={course}
      questions={shuffled.map(q => ({ ...q, order_index: q.order }))}
      progress={safeProgress}
      userId={user.id}
      hasNextDay={hasNextDay}
    />
  )
}
