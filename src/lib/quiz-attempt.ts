import { connectDB } from '@/lib/mongoose'
import { QuizAttempt } from '@/models/QuizAttempt'
import { Progress } from '@/models/Progress'

// An attempt counts the moment the questions are shown; submitting fills in the score.
// Leaving without submitting keeps it as an unfinished ('started') attempt.
export async function startAttempt(userId: string, courseId: string): Promise<string> {
  await connectDB()
  const attempt = await QuizAttempt.create({ userId, courseId, score: 0, passed: false, status: 'started' })
  await Progress.findOneAndUpdate(
    { userId, courseId },
    { $inc: { attempts: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
  return String(attempt._id)
}
