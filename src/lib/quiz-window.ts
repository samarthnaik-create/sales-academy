export const WINDOW_HOURS = 36
export const WARNING_HOURS = 6 // reminder email this long before the deadline
const WINDOW_MS = WINDOW_HOURS * 60 * 60 * 1000

export interface QuizWindow {
  deadline: Date | null // when the current window closes; null before the first attempt or once training is finished
  overdueMs: number     // how far past the current deadline (0 when on time)
  missed: number        // windows missed so far, including the current one if overdue
}

// Every quiz attempt (pass or fail) opens a fresh WINDOW_HOURS window to attempt the next quiz.
// Windows stop once all days are completed. Missing a window is only flagged, never blocked.
export function computeQuizWindow(attemptTimes: Date[], finishedAt: Date | null, now = new Date()): QuizWindow {
  let times = attemptTimes.map(t => new Date(t).getTime()).sort((a, b) => a - b)
  if (finishedAt) times = times.filter(t => t <= finishedAt.getTime())
  if (times.length === 0) return { deadline: null, overdueMs: 0, missed: 0 }

  let missed = 0
  for (let i = 1; i < times.length; i++) {
    if (times[i] - times[i - 1] > WINDOW_MS) missed++
  }
  if (finishedAt) return { deadline: null, overdueMs: 0, missed }

  const deadline = times[times.length - 1] + WINDOW_MS
  const overdueMs = Math.max(0, now.getTime() - deadline)
  if (overdueMs > 0) missed++
  return { deadline: new Date(deadline), overdueMs, missed }
}

// Training is finished when every day is completed; returns when the last one was
export function trainingFinishedAt(progress: { completed: boolean; completedAt?: Date | null }[], totalCourses: number): Date | null {
  const done = progress.filter(p => p.completed)
  if (totalCourses === 0 || done.length < totalCourses) return null
  const times = done.map(p => (p.completedAt ? new Date(p.completedAt).getTime() : 0))
  return new Date(Math.max(...times))
}

// First day (by dayNumber) the employee hasn't completed yet
export function nextIncompleteDay(
  courses: { _id: unknown; dayNumber: number }[],
  progress: { courseId: unknown; completed: boolean }[],
): number | undefined {
  const completedIds = new Set(progress.filter(p => p.completed).map(p => String(p.courseId)))
  return [...courses].sort((a, b) => a.dayNumber - b.dayNumber).find(c => !completedIds.has(String(c._id)))?.dayNumber
}

export function formatDuration(ms: number): string {
  const mins = Math.max(1, Math.floor(ms / 60000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
