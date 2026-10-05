'use client'
import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Lock, PlayCircle, Search, X } from 'lucide-react'

interface Course {
  id: string
  title: string
  description: string | null
  dayNumber: number
}

interface ProgressEntry {
  unlocked: boolean
  completed: boolean
  score: number
}

interface Props {
  courses: Course[]
  progressMap: Record<string, ProgressEntry>
}

function isUnlocked(courseId: string, dayNumber: number, progressMap: Record<string, ProgressEntry>, courses: Course[]): boolean {
  if (dayNumber === 1) return true
  if (progressMap[courseId]?.unlocked) return true
  const prev = courses.find(c => c.dayNumber === dayNumber - 1)
  if (!prev) return false
  const pp = progressMap[prev.id]
  return !!(pp?.completed && pp.score >= 80)
}

export function CourseSearch({ courses, progressMap }: Props) {
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? courses.filter(c =>
        c.title.toLowerCase().includes(query.toLowerCase()) ||
        (c.description ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : courses

  return (
    <div>
      {/* Search input */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search courses…"
          className="w-full pl-9 pr-9 py-2.5 border border-zinc-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-zinc-400 text-sm">
          <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>No courses match &ldquo;{query}&rdquo;</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map(course => {
            const prog = progressMap[course.id]
            const unlocked = isUnlocked(course.id, course.dayNumber, progressMap, courses)
            const done = prog?.completed ?? false
            return (
              <div key={course.id} className={`bg-white rounded-xl border ${done ? 'border-green-200' : unlocked ? 'border-zinc-200' : 'border-zinc-100'} p-5 transition-shadow hover:shadow-sm`}>
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${done ? 'bg-green-50 text-green-700' : unlocked ? 'bg-red-50 text-red-700' : 'bg-zinc-50 text-zinc-400'}`}>
                    {course.dayNumber}
                  </div>
                  {done
                    ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                    : !unlocked
                    ? <Lock className="h-4 w-4 text-zinc-300" />
                    : <PlayCircle className="h-5 w-5 text-red-400" />}
                </div>
                <h3 className={`font-semibold text-sm mb-1 ${unlocked ? 'text-zinc-900' : 'text-zinc-400'}`}>{course.title}</h3>
                {course.description && (
                  <p className="text-xs text-zinc-400 line-clamp-2 mb-3">{course.description}</p>
                )}
                {done && prog && (
                  <p className="text-xs text-green-600 font-medium mb-3">Score: {prog.score}%</p>
                )}
                {unlocked ? (
                  <Link href={`/day/${course.dayNumber}`} className="block text-center text-xs font-medium bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg transition-colors">
                    {done ? 'Review' : 'Start'}
                  </Link>
                ) : (
                  <div className="text-center text-xs text-zinc-400 py-2">Locked</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
