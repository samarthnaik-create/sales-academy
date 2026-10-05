import { requireUser } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { Course } from '@/models/Course'
import { Progress } from '@/models/Progress'
import { Quiz } from '@/models/Quiz'
import { checkCourseAccess } from '@/lib/unlock'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, PlayCircle, FileQuestion } from 'lucide-react'
import { LessonViewer } from '@/components/employee/lesson-viewer'

interface Props { params: Promise<{ dayNumber: string }> }

export default async function DayPage({ params }: Props) {
  const { dayNumber } = await params
  const user = await requireUser()

  await connectDB()

  const courseDoc = await Course.findOne({ dayNumber: parseInt(dayNumber) }).lean()
  if (!courseDoc) notFound()

  const courseId = String(courseDoc._id)
  const course = {
    ...courseDoc,
    id: courseId,
    description: courseDoc.description ?? null,
    videoUrl: courseDoc.videoUrl ?? null,
    videos: courseDoc.videos ?? null,
    content: courseDoc.content ?? null,
  }

  const [progressDoc, accessible] = await Promise.all([
    Progress.findOne({ userId: user.id, courseId }).lean(),
    checkCourseAccess(user.id, courseId, course.dayNumber),
  ])
  if (!accessible) redirect('/dashboard')

  const progress = progressDoc ? {
    completed: progressDoc.completed,
    score: progressDoc.score,
  } : null

  const quizCount = await Quiz.countDocuments({ courseId })

  return (
    <div className="max-w-2xl">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4" /> All Days
      </Link>

      <div className="mb-2">
        <span className="text-xs font-semibold text-red-600 uppercase tracking-wider">Day {course.dayNumber}</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-2">{course.title}</h1>
      {course.description && <p className="text-zinc-500 text-sm mb-6">{course.description}</p>}

      {/* Videos */}
      {(() => {
        function getEmbedUrl(url: string): string | null {
          const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
          if (yt) return `https://www.youtube.com/embed/${yt[1]}`
          const vimeo = url.match(/vimeo\.com\/(\d+)/)
          if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
          const drive = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/)
          if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`
          return null
        }

        // Parse videos array (new) or fall back to legacy single videoUrl
        let videoList: { title: string; url: string }[] = []
        if (course.videos) {
          try { const p = JSON.parse(course.videos); if (Array.isArray(p)) videoList = p } catch {}
        }
        if (videoList.length === 0 && course.videoUrl) {
          videoList = [{ title: '', url: course.videoUrl }]
        }
        const validVideos = videoList.filter(v => v.url.trim())
        if (validVideos.length === 0) return null

        return (
          <div className="space-y-4 mb-4">
            {validVideos.map((v, i) => {
              const embedUrl = getEmbedUrl(v.url)
              return embedUrl ? (
                <div key={i}>
                  {v.title && (
                    <div className="flex items-center gap-2 mb-2">
                      <PlayCircle className="h-4 w-4 text-red-600" />
                      <p className="font-semibold text-sm text-zinc-900">{v.title}</p>
                    </div>
                  )}
                  <div className="bg-black rounded-xl overflow-hidden aspect-video">
                    <iframe src={embedUrl} className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen />
                  </div>
                </div>
              ) : (
                <div key={i} className="bg-white rounded-xl border border-zinc-200 p-4 flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center shrink-0">
                    <PlayCircle className="h-4 w-4 text-red-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-zinc-900">{v.title || 'Training Video'}</p>
                    <a href={v.url} target="_blank" rel="noopener noreferrer" className="text-xs text-red-600 hover:underline">Open video →</a>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* Lesson modules viewer */}
      {course.content && (
        <LessonViewer
          content={course.content}
          courseId={course.id}
          dayNumber={course.dayNumber}
          quizCount={quizCount}
          completed={progress?.completed ?? false}
          bestScore={progress?.score ?? 0}
        />
      )}

      {/* Quiz card (shown if no content, or as standalone) */}
      {!course.content && (
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
              <FileQuestion className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <p className="font-semibold text-sm text-zinc-900">Quiz · {course.title}</p>
              <p className="text-xs text-zinc-400">{quizCount > 0 ? `${quizCount} questions` : 'AI-generated questions'} · Pass 80%</p>
            </div>
          </div>
          {progress?.completed && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2 mb-4">
              <CheckCircle2 className="h-4 w-4" /> Completed · Best score: {progress.score}%
            </div>
          )}
          <Link href={`/quiz/${course.id}`}
            className="block text-center bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
            {progress?.completed ? 'Retake Quiz' : 'Start Quiz'}
          </Link>
        </div>
      )}
    </div>
  )
}
