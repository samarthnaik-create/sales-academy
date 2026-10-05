import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { Course } from '@/models/Course'
import { Quiz } from '@/models/Quiz'

interface Props { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Props) {
  try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  const { id } = await params
  const { title, description, dayNumber, videoUrl, videos, content, quizzes, aiTopup } = await req.json()

  await connectDB()

  await Quiz.deleteMany({ courseId: id })
  await Course.findByIdAndUpdate(id, {
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
      quizzes.map((q: { question: string; options: string[]; answer: string }, i: number) => ({
        courseId: id,
        question: q.question,
        options: q.options,
        answer: q.answer,
        order: i,
      }))
    )
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Props) {
  try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  const { id } = await params
  await connectDB()
  await Course.findByIdAndDelete(id)
  return NextResponse.json({ ok: true })
}
