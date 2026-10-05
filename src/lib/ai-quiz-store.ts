import { connectDB } from '@/lib/mongoose'
import { QuizSession } from '@/models/QuizSession'

interface AiQuizSession {
  courseId: string
  userId: string
  answers: Record<string, string>
  explanations: Record<string, string>
  expiresAt: number
}

export async function storeSession(sessionId: string, session: AiQuizSession) {
  await connectDB()
  await QuizSession.findOneAndUpdate(
    { _id: sessionId },
    {
      courseId: session.courseId,
      userId: session.userId,
      answers: session.answers,
      explanations: session.explanations,
      expiresAt: new Date(session.expiresAt),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
}

export async function getSession(sessionId: string): Promise<AiQuizSession | null> {
  await connectDB()
  const s = await QuizSession.findById(sessionId).lean()
  if (!s) return null
  if (new Date() > s.expiresAt) {
    await QuizSession.findByIdAndDelete(sessionId)
    return null
  }
  return {
    courseId: s.courseId,
    userId: s.userId,
    answers: s.answers as Record<string, string>,
    explanations: s.explanations as Record<string, string>,
    expiresAt: s.expiresAt.getTime(),
  }
}

export async function deleteSession(sessionId: string) {
  await connectDB()
  await QuizSession.findByIdAndDelete(sessionId).catch(() => {})
}
