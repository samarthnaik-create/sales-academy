import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { Course } from '@/models/Course'
import { clampQuestionCount } from '@/lib/quiz-config'
import { Quiz } from '@/models/Quiz'
import { Progress } from '@/models/Progress'
import { PASS_THRESHOLD } from '@/lib/quiz-config'
import { str, cleanQuizzes, parseDayNumber } from '@/lib/validate'

export async function POST(req: NextRequest) {
  try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

  const body = await req.json()
  const { description, videoUrl, videos, content, aiTopup, questionCount } = body
  const dayNumber = parseDayNumber(body.dayNumber)
  const title = str(body.title, 200)
  if (!title || !dayNumber) return NextResponse.json({ error: 'Title and day number required' }, { status: 400 })
  const quizzes = cleanQuizzes(body.quizzes)
  if (!quizzes) return NextResponse.json({ error: 'Every question needs text, at least 2 options and a correct answer' }, { status: 400 })

  await connectDB()

  const existing = await Course.findOne({ dayNumber }).lean()
  if (existing) return NextResponse.json({ error: `Day ${dayNumber} already exists` }, { status: 409 })

  const course = await Course.create({
    title,
    description: str(description, 2000) || undefined,
    dayNumber,
    videoUrl: str(videoUrl, 2000) || undefined,
    videos: typeof videos === 'string' && videos ? videos : undefined,
    content: typeof content === 'string' && content ? content : undefined,
    aiTopup: !!aiTopup,
    questionCount: clampQuestionCount(questionCount),
  })

  if (quizzes.length) {
    await Quiz.insertMany(quizzes.map((q, i) => ({ courseId: course._id, ...q, order: i })))
  }

  // Auto-unlock this new course for employees who already passed the previous day
  if (dayNumber > 1) {
    const prevCourse = await Course.findOne({ dayNumber: dayNumber - 1 }).lean()
    if (prevCourse) {
      const passedPrev = await Progress.find(
        { courseId: prevCourse._id, completed: true, score: { $gte: PASS_THRESHOLD } },
        { userId: 1 }
      ).lean()
      if (passedPrev.length > 0) {
        await Promise.all(passedPrev.map(p =>
          Progress.findOneAndUpdate(
            { userId: p.userId, courseId: course._id },
            { $set: { unlocked: true } },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
          )
        ))
      }
    }
  }

  return NextResponse.json({ id: String(course._id) })
}
