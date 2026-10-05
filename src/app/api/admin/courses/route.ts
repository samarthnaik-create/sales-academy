import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { Course } from '@/models/Course'
import { Quiz } from '@/models/Quiz'
import { Progress } from '@/models/Progress'

export async function POST(req: NextRequest) {
  try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

  const { title, description, dayNumber, videoUrl, videos, content, quizzes, aiTopup } = await req.json()
  if (!title || !dayNumber) return NextResponse.json({ error: 'Title and day number required' }, { status: 400 })

  await connectDB()

  const existing = await Course.findOne({ dayNumber }).lean()
  if (existing) return NextResponse.json({ error: `Day ${dayNumber} already exists` }, { status: 409 })

  const course = await Course.create({
    title,
    description: description || undefined,
    dayNumber,
    videoUrl: videoUrl || undefined,
    videos: videos || undefined,
    content: content || undefined,
    aiTopup: !!aiTopup,
  })

  if (quizzes?.length) {
    await Quiz.insertMany(
      quizzes.map((q: { question: string; options: string[]; answer: string; order: number }, i: number) => ({
        courseId: course._id,
        question: q.question,
        options: q.options,
        answer: q.answer,
        order: i,
      }))
    )
  }

  // Auto-unlock this new course for employees who already passed the previous day
  if (dayNumber > 1) {
    const prevCourse = await Course.findOne({ dayNumber: dayNumber - 1 }).lean()
    if (prevCourse) {
      const passedPrev = await Progress.find(
        { courseId: prevCourse._id, completed: true, score: { $gte: 80 } },
        { userId: 1 }
      ).lean()
      if (passedPrev.length > 0) {
        await Promise.all(passedPrev.map(p =>
          Progress.findOneAndUpdate(
            { userId: p.userId, courseId: course._id },
            { $set: { unlocked: true } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          )
        ))
      }
    }
  }

  return NextResponse.json({ id: String(course._id) })
}
