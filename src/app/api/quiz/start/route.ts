import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { getSession } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { Course } from '@/models/Course'
import { startAttempt } from '@/lib/quiz-attempt'

// Manual-question quizzes call this when the employee starts; AI quizzes start inside /api/quiz/generate
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { courseId } = await req.json()
  if (!mongoose.isValidObjectId(courseId)) return NextResponse.json({ error: 'Invalid course' }, { status: 400 })

  await connectDB()
  if (!(await Course.exists({ _id: courseId }))) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

  const attemptId = await startAttempt(session.user.id, courseId)
  return NextResponse.json({ attemptId })
}
