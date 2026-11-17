export const dynamic = 'force-dynamic'

import { requireAdmin } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { Course } from '@/models/Course'
import { Quiz } from '@/models/Quiz'
import Link from 'next/link'
import { PageHeader, bandButton } from '@/components/ui/page-header'
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
    <div className="space-y-6">
      <PageHeader
        title="Courses"
        subtitle={`${courses.length} training ${courses.length === 1 ? 'day' : 'days'} · lessons and quizzes`}
        actions={<Link href="/admin/courses/new" className={bandButton}><Plus className="h-4 w-4" /> Add day</Link>}
      />

      {courses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200 py-16 text-center text-zinc-400">
          <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No courses yet</p>
          <p className="text-sm mt-1">Add your first course to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {courses.map(c => (
            <Link key={c.id} href={`/admin/courses/${c.id}`} className="group bg-white rounded-2xl border border-zinc-200 p-5 flex items-center justify-between transition-[border-color,box-shadow] hover:border-red-200 hover:shadow-md">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center shrink-0 transition-colors group-hover:bg-red-800">
                  <span className="text-red-800 font-bold text-sm transition-colors group-hover:text-white">{c.dayNumber}</span>
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
