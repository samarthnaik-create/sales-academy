import mongoose from 'mongoose'
import { connectDB } from '@/lib/mongoose'
import { QuizAttempt } from '@/models/QuizAttempt'
import { Progress } from '@/models/Progress'
import { Course } from '@/models/Course'
import { PASS_THRESHOLD } from '@/lib/quiz-config'

type AnswerMap = Record<string, string>

// Keep only answers to questions in this quiz
function cleanAnswers(raw: unknown, key: AnswerMap): AnswerMap {
  const out: AnswerMap = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [id, ans] of Object.entries(raw as Record<string, unknown>)) {
    if (id in key && typeof ans === 'string') out[id] = ans
  }
  return out
}

const clampSwitches = (n: unknown) => Math.min(100, Math.max(0, Math.round(Number(n)) || 0))

// An attempt counts the moment the questions are shown. The answer key is stored with it
// (never sent to the browser) so it can be scored whenever and however it ends.
export async function startAttempt(userId: string, courseId: string, key: AnswerMap, explanations: AnswerMap): Promise<string> {
  await connectDB()
  // Starting again means any quiz left open was abandoned: score what was answered
  await finalizeOpenAttempts({ userId })
  const attempt = await QuizAttempt.create({ userId, courseId, score: 0, passed: false, status: 'started', key, explanations })
  await Progress.findOneAndUpdate(
    { userId, courseId },
    { $inc: { attempts: 1 } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  )
  return String(attempt._id)
}

// Saved as the employee answers, so leaving midway can still be scored
export async function saveAnswers(attemptId: string, userId: string, answers: unknown, tabSwitches: unknown) {
  if (!mongoose.isValidObjectId(attemptId)) return false
  await connectDB()
  const attempt = await QuizAttempt.findOne({ _id: attemptId, userId, status: 'started' }, { key: 1 }).lean()
  if (!attempt?.key) return false
  await QuizAttempt.updateOne(
    { _id: attemptId, status: 'started' },
    { $set: { answers: cleanAnswers(answers, attempt.key), tabSwitches: clampSwitches(tabSwitches) } }
  )
  return true
}

// Scores an open attempt out of ALL its questions (unanswered = wrong) and records the result.
// Returns null if it was already finished.
export async function finalizeAttempt(
  attemptId: string,
  userId: string,
  opts: { answers?: unknown; tabSwitches?: unknown; exited: boolean },
) {
  if (!mongoose.isValidObjectId(attemptId)) return null
  await connectDB()
  const attempt = await QuizAttempt.findOne({ _id: attemptId, userId, status: 'started' }).lean()
  if (!attempt?.key) return null

  const key = attempt.key as AnswerMap
  const answers = { ...cleanAnswers(attempt.answers, key), ...cleanAnswers(opts.answers, key) }
  const total = Object.keys(key).length
  const correctCount = Object.entries(answers).filter(([id, ans]) => key[id] === ans).length
  const score = total > 0 ? Math.round((correctCount / total) * 100) : 0
  const passed = score >= PASS_THRESHOLD
  const tabSwitches = opts.tabSwitches === undefined ? (attempt.tabSwitches ?? 0) : clampSwitches(opts.tabSwitches)

  // Atomic status flip, so a submit and a leave-beacon can't both score it
  const claimed = await QuizAttempt.findOneAndUpdate(
    { _id: attemptId, status: 'started' },
    { $set: { status: 'submitted', submittedAt: new Date(), score, passed, answers, tabSwitches, exited: opts.exited } },
  )
  if (!claimed) return null

  await recordResult(userId, String(attempt.courseId), score, passed)
  return { score, passed, correctCount, total, correctAnswers: key, explanations: (attempt.explanations ?? {}) as AnswerMap }
}

// Scores attempts that were left open (tab closed, browser crashed…)
export async function finalizeOpenAttempts(filter: { userId?: string; startedBefore?: Date }) {
  await connectDB()
  const open = await QuizAttempt.find({
    status: 'started',
    key: { $exists: true },
    ...(filter.userId ? { userId: filter.userId } : {}),
    ...(filter.startedBefore ? { createdAt: { $lt: filter.startedBefore } } : {}),
  }, { userId: 1 }).lean()
  for (const a of open) await finalizeAttempt(String(a._id), String(a.userId), { exited: true })
  return open.length
}

async function recordResult(userId: string, courseId: string, score: number, passed: boolean) {
  const existing = await Progress.findOne({ userId, courseId }).lean()
  await Progress.findOneAndUpdate(
    { userId, courseId },
    // Failing a retake must not un-complete a day; completedAt keeps the first pass
    { $set: { score: Math.max(score, existing?.score ?? 0), ...(passed && !existing?.completed ? { completed: true, completedAt: new Date() } : {}) } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  )
  if (!passed) return

  const course = await Course.findById(courseId, { dayNumber: 1 }).lean()
  if (course) {
    const next = await Course.findOne({ dayNumber: course.dayNumber + 1 }, { _id: 1 }).lean()
    if (next) {
      await Progress.findOneAndUpdate(
        { userId, courseId: next._id },
        { $set: { unlocked: true } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      )
    }
  }
}
