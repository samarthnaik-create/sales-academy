import { connectDB } from '@/lib/mongoose'
import { Progress } from '@/models/Progress'
import { Course } from '@/models/Course'

/**
 * Returns true if an employee should have access to a course.
 * Access is granted if:
 *   - It's Day 1 (always open), OR
 *   - The Progress record has unlocked=true, OR
 *   - The employee passed (score ≥ 80, completed) the previous day's course
 *
 * When implicit access is detected via the third rule, the unlock record is
 * auto-written so future visits are instant — no manual DB fixes needed.
 */
export async function checkCourseAccess(
  userId: string,
  courseId: string,
  dayNumber: number
): Promise<boolean> {
  if (dayNumber === 1) return true

  await connectDB()

  const progress = await Progress.findOne({ userId, courseId }).lean()
  if (progress?.unlocked) return true

  // Check if previous day was passed
  const prevCourse = await Course.findOne({ dayNumber: dayNumber - 1 }).select('_id').lean()
  if (!prevCourse) return false

  const prevProgress = await Progress.findOne({ userId, courseId: prevCourse._id }).lean()

  if (prevProgress?.completed && prevProgress.score >= 80) {
    // Auto-write so next visit doesn't need this check
    await Progress.findOneAndUpdate(
      { userId, courseId },
      { $set: { unlocked: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
    return true
  }

  return false
}

/**
 * In-memory version for the dashboard (which already loaded all courses + progress).
 * No extra DB queries — computes access from the data already fetched.
 */
export function computeUnlocked(
  courseId: string,
  dayNumber: number,
  progressMap: Record<string, { unlocked: boolean; completed: boolean; score: number }>,
  courses: { id: string; dayNumber: number }[]
): boolean {
  if (dayNumber === 1) return true
  if (progressMap[courseId]?.unlocked) return true
  const prev = courses.find(c => c.dayNumber === dayNumber - 1)
  if (!prev) return false
  const pp = progressMap[prev.id]
  return !!(pp?.completed && pp.score >= 80)
}
