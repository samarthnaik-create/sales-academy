import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { getSession } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { Course } from '@/models/Course'
import { Quiz } from '@/models/Quiz'
import { startAttempt } from '@/lib/quiz-attempt'
import { checkCourseAccess } from '@/lib/unlock'

// Manual-question quizzes call this when the employee starts; AI quizzes start inside /api/quiz/generate
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { courseId } = await req.json()
  if (!mongoose.isValidObjectId(courseId)) return NextResponse.json({ error: 'Invalid course' }, { status: 400 })

  await connectDB()
  const course = await Course.findById(courseId, { dayNumber: 1 }).lean()
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  if (!(await checkCourseAccess(session.user.id, courseId, course.dayNumber))) {
    return NextResponse.json({ error: 'This day is still locked' }, { status: 403 })
  }

  const quizzes = await Quiz.find({ courseId }, { answer: 1 }).lean()
  if (quizzes.length === 0) return NextResponse.json({ error: 'This quiz has no questions' }, { status: 400 })
  const key = Object.fromEntries(quizzes.map(q => [String(q._id), q.answer]))

  const attemptId = await startAttempt(session.user.id, courseId, key, {})
  return NextResponse.json({ attemptId })
}
