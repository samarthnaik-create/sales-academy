import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { Course } from '@/models/Course'
import { clampQuestionCount } from '@/lib/quiz-config'
import { Quiz } from '@/models/Quiz'
import { Progress } from '@/models/Progress'
import { Note } from '@/models/Note'
import { QuizAttempt } from '@/models/QuizAttempt'
import { isId, str, cleanQuizzes, parseDayNumber } from '@/lib/validate'

interface Props { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Props) {
  try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  const { id } = await params
  if (!isId(id)) return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  const { title, description, dayNumber, videoUrl, videos, content, quizzes, aiTopup, questionCount } = await req.json()

  const day = parseDayNumber(dayNumber)
  const cleanTitle = str(title, 200)
  if (!cleanTitle || !day) return NextResponse.json({ error: 'Title and day number required' }, { status: 400 })
  const questions = cleanQuizzes(quizzes)
  if (!questions) return NextResponse.json({ error: 'Every question needs text, at least 2 options and a correct answer' }, { status: 400 })

  await connectDB()
  if (!(await Course.exists({ _id: id }))) return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  if (await Course.exists({ dayNumber: day, _id: { $ne: id } })) {
    return NextResponse.json({ error: `Day ${day} already exists` }, { status: 409 })
  }

  // Save the course first, so a failure can't leave it with its questions deleted
  await Course.findByIdAndUpdate(id, {
    title: cleanTitle,
    description: str(description, 2000) || undefined,
    dayNumber: day,
    videoUrl: str(videoUrl, 2000) || undefined,
    videos: typeof videos === 'string' && videos ? videos : undefined,
    content: typeof content === 'string' && content ? content : undefined,
    aiTopup: !!aiTopup,
    questionCount: clampQuestionCount(questionCount),
  })

  // Replace the questions: add the new set, then remove the old ones
  const old = await Quiz.find({ courseId: id }, { _id: 1 }).lean()
  if (questions.length) {
    await Quiz.insertMany(questions.map((q, i) => ({ courseId: id, ...q, order: i })))
  }
  if (old.length) await Quiz.deleteMany({ _id: { $in: old.map(q => q._id) } })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Props) {
  try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  const { id } = await params
  if (!isId(id)) return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  await connectDB()
  await Course.findByIdAndDelete(id)
  // Remove everything that belonged to this day
  await Promise.all([
    Quiz.deleteMany({ courseId: id }),
    Progress.deleteMany({ courseId: id }),
    Note.deleteMany({ courseId: id }),
    QuizAttempt.deleteMany({ courseId: id }),
  ])
  return NextResponse.json({ ok: true })
}
