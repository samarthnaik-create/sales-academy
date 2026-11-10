import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { getSession } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { Quiz } from '@/models/Quiz'
import { QuizAttempt } from '@/models/QuizAttempt'
import { Progress } from '@/models/Progress'
import { Course } from '@/models/Course'
import { Certificate } from '@/models/Certificate'
import { getSession as getAiSession, deleteSession } from '@/lib/ai-quiz-store'

const PASS_THRESHOLD = 90

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { courseId, answers, sessionId, attemptId, tabSwitches: rawSwitches } = await req.json() as { courseId: string; answers: Record<string, string>; sessionId?: string; attemptId?: string; tabSwitches?: unknown }
  const tabSwitches = Math.min(100, Math.max(0, Math.round(Number(rawSwitches)) || 0))

  // The attempt was recorded when the quiz started; it can be submitted only once
  if (attemptId) {
    await connectDB()
    const open = mongoose.isValidObjectId(attemptId) && await QuizAttempt.exists({ _id: attemptId, userId: session.user.id, courseId, status: 'started' })
    if (!open) return NextResponse.json({ error: 'This attempt was already submitted or is invalid' }, { status: 400 })
  }

  let correctAnswers: Record<string, string> = {}
  let explanations: Record<string, string> = {}
  let total = 0

  if (sessionId) {
    const aiSession = await getAiSession(sessionId)
    if (!aiSession || aiSession.courseId !== courseId || aiSession.userId !== session.user.id) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 400 })
    }
    correctAnswers = aiSession.answers
    explanations = aiSession.explanations
    total = Object.keys(correctAnswers).length
    await deleteSession(sessionId)
  } else {
    await connectDB()
    const quizzes = await Quiz.find({ courseId }, { answer: 1 }).lean()
    for (const q of quizzes) correctAnswers[String(q._id)] = q.answer
    total = quizzes.length
  }

  if (!sessionId) {
    // connectDB already called above
  } else {
    await connectDB()
  }

  let correctCount = 0
  for (const [id, ans] of Object.entries(answers)) {
    if (correctAnswers[id] === ans) correctCount++
  }

  const score = total > 0 ? Math.round((correctCount / total) * 100) : 0
  const passed = score >= PASS_THRESHOLD

  const result = { score, passed, answers, tabSwitches, status: 'submitted', submittedAt: new Date() }
  if (attemptId) {
    const updated = await QuizAttempt.findOneAndUpdate({ _id: attemptId, status: 'started' }, { $set: result })
    if (!updated) return NextResponse.json({ error: 'This attempt was already submitted' }, { status: 400 })
  } else {
    // Clients from before attempts were recorded at start
    await QuizAttempt.create({ userId: session.user.id, courseId, ...result })
  }

  const existing = await Progress.findOne({ userId: session.user.id, courseId }).lean()
  const bestScore = Math.max(score, existing?.score ?? 0)
  await Progress.findOneAndUpdate(
    { userId: session.user.id, courseId },
    {
      // Failing a retake must not un-complete a day; completedAt keeps the first pass
      $set: { score: bestScore, ...(passed && !existing?.completed ? { completed: true, completedAt: new Date() } : {}) },
      // Attempts are counted at start; only count here for old clients
      ...(attemptId ? {} : { $inc: { attempts: 1 } }),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )

  if (passed) {
    const course = await Course.findById(courseId, { dayNumber: 1 }).lean()
    if (course && course.dayNumber < 15) {
      const next = await Course.findOne({ dayNumber: course.dayNumber + 1 }, { _id: 1 }).lean()
      if (next) {
        await Progress.findOneAndUpdate(
          { userId: session.user.id, courseId: next._id },
          { $set: { unlocked: true } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
      }
    }
    if (course?.dayNumber === 15) {
      await Certificate.findOneAndUpdate(
        { userId: session.user.id },
        { $setOnInsert: { completionDate: new Date().toISOString().split('T')[0] } },
        { upsert: true, new: true }
      )
    }
  }

  return NextResponse.json({ score, passed, correctCount, total, correctAnswers, explanations })
}
