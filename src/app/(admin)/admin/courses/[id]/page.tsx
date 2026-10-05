export const dynamic = 'force-dynamic'

import { requireAdmin } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { Course } from '@/models/Course'
import { Quiz } from '@/models/Quiz'
import { notFound } from 'next/navigation'
import { CourseEditor } from '@/components/admin/course-editor'

interface Props { params: Promise<{ id: string }> }

export default async function CoursePage({ params }: Props) {
  await requireAdmin()
  const { id } = await params

  const isNew = id === 'new'
  let course = null

  if (!isNew) {
    await connectDB()
    const courseDoc = await Course.findById(id).lean()
    if (!courseDoc) notFound()

    const quizDocs = await Quiz.find({ courseId: id }).sort({ order: 1 }).lean()

    course = {
      id: String(courseDoc._id),
      title: courseDoc.title,
      description: courseDoc.description ?? null,
      dayNumber: courseDoc.dayNumber,
      videoUrl: courseDoc.videoUrl ?? null,
      videos: courseDoc.videos ?? null,
      content: courseDoc.content ?? null,
      aiTopup: courseDoc.aiTopup,
      quizzes: quizDocs.map(q => ({
        id: String(q._id),
        question: q.question,
        options: q.options,
        answer: q.answer,
        order: q.order,
      })),
    }
  }

  return <CourseEditor course={course} />
}
