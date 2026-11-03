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

  // Never select `answer` here — everything below is serialized to the client
  const quizDocs = await Quiz.find({ courseId }, { question: 1, options: 1, order: 1 }).sort({ order: 1 }).lean()
  const questions = quizDocs.map(q => ({
    id: String(q._id),
    question: q.question,
    options: q.options,
    order_index: q.order,
  }))

  const course = {
    id: courseId,
    title: courseDoc.title,
    dayNumber: courseDoc.dayNumber,
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

  if (courseDoc.aiTopup || questions.length === 0) {
    return <AiQuizStarter course={course} progress={safeProgress} userId={user.id} hasNextDay={hasNextDay} />
  }

  const shuffled = [...questions]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  return (
    <QuizEngine
      course={course}
      questions={shuffled}
      progress={safeProgress}
      userId={user.id}
      hasNextDay={hasNextDay}
    />
  )
}
