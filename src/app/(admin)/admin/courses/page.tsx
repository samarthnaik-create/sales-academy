import { requireAdmin } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { Course } from '@/models/Course'
import { Quiz } from '@/models/Quiz'
import Link from 'next/link'
import { Plus, BookOpen, FileQuestion } from 'lucide-react'

export default async function CoursesPage() {
  await requireAdmin()
  await connectDB()

  const courseDocs = await Course.find().sort({ dayNumber: 1 }).lean()
  const courseIds = courseDocs.map(c => c._id)

  // Count quizzes per course
  const quizCounts = await Quiz.aggregate([
    { $match: { courseId: { $in: courseIds } } },
    { $group: { _id: '$courseId', count: { $sum: 1 } } },
  ])
  const quizCountMap = Object.fromEntries(quizCounts.map((q: { _id: unknown; count: number }) => [String(q._id), q.count]))

  const courses = courseDocs.map(c => ({
    id: String(c._id),
    title: c.title,
    description: c.description ?? null,
    dayNumber: c.dayNumber,
    quizCount: quizCountMap[String(c._id)] ?? 0,
  }))

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Courses</h1>
          <p className="text-zinc-500 text-sm mt-1">{courses.length} courses · 15 days total</p>
        </div>
        <Link href="/admin/courses/new" className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus className="h-4 w-4" /> Add Course
        </Link>
      </div>

      {courses.length === 0 ? (
        <div className="bg-white rounded-xl border border-zinc-200 py-16 text-center text-zinc-400">
          <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No courses yet</p>
          <p className="text-sm mt-1">Add your first course to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {courses.map(c => (
            <Link key={c.id} href={`/admin/courses/${c.id}`} className="bg-white rounded-xl border border-zinc-200 p-5 flex items-center justify-between hover:shadow-sm transition-shadow block">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-white font-bold text-sm">{c.dayNumber}</span>
                </div>
                <div>
                  <p className="font-semibold text-zinc-900">{c.title}</p>
                  {c.description && <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{c.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 text-zinc-400 text-xs shrink-0">
                <FileQuestion className="h-3.5 w-3.5" />
                {c.quizCount > 0 ? `${c.quizCount} questions` : 'AI quiz'}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
