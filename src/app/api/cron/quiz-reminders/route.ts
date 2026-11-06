import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongoose'
import { User } from '@/models/User'
import { Course } from '@/models/Course'
import { Progress } from '@/models/Progress'
import { QuizAttempt } from '@/models/QuizAttempt'
import { EmailLog } from '@/models/EmailLog'
import { computeQuizWindow, trainingFinishedAt, nextIncompleteDay, WARNING_HOURS } from '@/lib/quiz-window'
import { emailConfigured, sendEmail, quizWarningEmail, quizOverdueEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Called hourly by .github/workflows/quiz-reminders.yml with "Authorization: Bearer <CRON_SECRET>".
// Sends each employee at most one warning and one overdue email per quiz deadline. ?dry=1 previews without sending.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const dry = req.nextUrl.searchParams.get('dry') === '1'
  if (!dry && !emailConfigured()) return NextResponse.json({ error: 'Email not configured' }, { status: 500 })

  await connectDB()
  const [employees, courses, allProgress, allAttempts] = await Promise.all([
    User.find({ role: 'employee' }, { name: 1, email: 1 }).lean(),
    Course.find({}, { dayNumber: 1 }).lean(),
    Progress.find({}, { userId: 1, courseId: 1, completed: 1, completedAt: 1 }).lean(),
    QuizAttempt.find({}, { userId: 1, createdAt: 1 }).lean(),
  ])

  // Dry runs may preview a future moment with ?at=<ISO date>
  const at = dry ? req.nextUrl.searchParams.get('at') : null
  const now = at && !isNaN(Date.parse(at)) ? new Date(at) : new Date()
  const origin = req.nextUrl.origin
  const results: { name: string; kind: string; day: number; status: string }[] = []

  for (const emp of employees) {
    const uid = String(emp._id)
    const progress = allProgress.filter(p => String(p.userId) === uid)
    const attempts = allAttempts.filter(a => String(a.userId) === uid).map(a => a.createdAt)
    const w = computeQuizWindow(attempts, trainingFinishedAt(progress, courses.length), now)
    const day = nextIncompleteDay(courses, progress)
    if (!w.deadline || !day || !emp.email) continue

    const kind = w.overdueMs > 0 ? 'quiz-overdue'
      : w.deadline.getTime() - now.getTime() <= WARNING_HOURS * 60 * 60 * 1000 ? 'quiz-warning'
      : null
    if (!kind) continue

    const key = { userId: emp._id, kind, deadline: w.deadline }
    if (dry) {
      results.push({ name: emp.name, kind, day, status: (await EmailLog.exists(key)) ? 'already sent' : 'would send' })
      continue
    }
    // Claim the slot first so overlapping runs can't double-send
    try { await EmailLog.create(key) } catch (err) {
      if ((err as { code?: number }).code === 11000) continue
      throw err
    }
    const link = `${origin}/day/${day}`
    const { subject, html } = kind === 'quiz-overdue'
      ? quizOverdueEmail(emp.name, day, w.deadline, link)
      : quizWarningEmail(emp.name, day, w.deadline, link)
    try {
      await sendEmail(emp.email, subject, html)
      results.push({ name: emp.name, kind, day, status: 'sent' })
    } catch (err) {
      await EmailLog.deleteOne(key) // retry on the next run
      results.push({ name: emp.name, kind, day, status: `failed: ${err instanceof Error ? err.message : 'unknown'}` })
    }
  }

  return NextResponse.json({ dry, at: now.toISOString(), checked: employees.length, results })
}
