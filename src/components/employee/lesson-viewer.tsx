'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, CheckCircle2, Circle, Lock, PlayCircle,
  StickyNote, FileQuestion, Trophy, BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface VideoEntry { title: string; url: string }
interface Module { title: string; html: string; videos?: VideoEntry[] }
interface TopicGroup { title: string; modules: Module[] }

interface Props {
  course: { id: string; dayNumber: number; title: string; description: string | null; content: string | null; videos: VideoEntry[] }
  quiz: { questionCount: number; passMark: number; completed: boolean; bestScore: number; attempts: number; hasNextDay: boolean }
  start: { topicIdx: number; moduleIdx: number; read: string[] }
}

function getEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const vimeo = url.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  const drive = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/)
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`
  return null
}

function parseTopics(content: string | null): TopicGroup[] {
  if (!content) return []
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed) && parsed.length > 0) {
      if ('modules' in parsed[0] && Array.isArray((parsed[0] as TopicGroup).modules)) {
        return (parsed as TopicGroup[]).filter(t => t.modules?.length)
      }
      if ('html' in parsed[0]) return [{ title: '', modules: parsed as Module[] }]
    }
  } catch {}
  return [{ title: '', modules: [{ title: 'Lesson', html: content }] }]
}

const key = (ti: number, mi: number) => `${ti}-${mi}`

function Videos({ videos }: { videos: VideoEntry[] }) {
  return (
    <div className="space-y-4">
      {videos.map((v, i) => {
        const embed = getEmbedUrl(v.url)
        return embed ? (
          <div key={i}>
            {v.title && (
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-700">
                <PlayCircle className="h-4 w-4 text-red-800" /> {v.title}
              </p>
            )}
            <div className="aspect-video overflow-hidden rounded-xl bg-black">
              <iframe src={embed} className="h-full w-full" allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
            </div>
          </div>
        ) : (
          <a key={i} href={v.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border border-zinc-200 px-4 py-3 text-sm transition-colors hover:bg-zinc-50">
            <PlayCircle className="h-5 w-5 text-red-800" />
            <span className="font-medium text-zinc-800">{v.title || 'Training video'}</span>
            <span className="ml-auto text-xs text-zinc-400">Opens in a new tab</span>
          </a>
        )
      })}
    </div>
  )
}

export function LessonViewer({ course, quiz, start }: Props) {
  const topics = useMemo(() => parseTopics(course.content), [course.content])
  const flat = useMemo(() => topics.flatMap((t, ti) => t.modules.map((m, mi) => ({ ti, mi, title: m.title, topic: t.title }))), [topics])
  const total = flat.length
  const named = topics.some(t => t.title)

  // Open where the employee left off (if that module still exists)
  const startOk = !!topics[start.topicIdx]?.modules[start.moduleIdx]
  const [pos, setPos] = useState({ ti: startOk ? start.topicIdx : 0, mi: startOk ? start.moduleIdx : 0 })
  const [read, setRead] = useState<Set<string>>(() => new Set(start.read))
  const [openTopics, setOpenTopics] = useState<Set<number>>(() => new Set([startOk ? start.topicIdx : 0]))

  const [notes, setNotes] = useState<Record<string, string>>({})
  const [noteState, setNoteState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [showNote, setShowNote] = useState(false)
  const noteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const lessonTop = useRef<HTMLDivElement>(null)
  const quizRef = useRef<HTMLDivElement>(null)

  const flatIdx = flat.findIndex(f => f.ti === pos.ti && f.mi === pos.mi)
  const current = topics[pos.ti]?.modules[pos.mi]
  const prevItem = flatIdx > 0 ? flat[flatIdx - 1] : null
  const nextItem = flatIdx >= 0 && flatIdx < total - 1 ? flat[flatIdx + 1] : null
  const currentKey = key(pos.ti, pos.mi)

  const readCount = flat.filter(f => read.has(key(f.ti, f.mi))).length
  // Passing the quiz already proves the day was read; a day without reading is open straight away
  const quizOpen = quiz.completed || total === 0 || readCount >= total
  const pct = total ? Math.round((readCount / total) * 100) : 100

  useEffect(() => {
    fetch(`/api/notes?courseId=${course.id}`)
      .then(r => r.json())
      .then(data => {
        const map: Record<string, string> = {}
        for (const n of data.notes ?? []) map[n.moduleKey] = n.content
        setNotes(map)
      })
      .catch(() => {})
  }, [course.id])

  // Save position and read modules (debounced) so the next visit picks up here
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (total === 0) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      fetch('/api/progress/position', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: course.id, topicIdx: pos.ti, moduleIdx: pos.mi, read: [...read] }),
        keepalive: true,
      }).catch(() => {})
    }, 1000)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [course.id, pos, read, total])

  function go(ti: number, mi: number) {
    setRead(prev => new Set(prev).add(currentKey))
    setPos({ ti, mi })
    setOpenTopics(prev => new Set(prev).add(ti))
    setShowNote(false)
    lessonTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function finish() {
    setRead(prev => new Set(prev).add(currentKey))
    setTimeout(() => quizRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  }

  function updateNote(k: string, value: string) {
    setNotes(prev => ({ ...prev, [k]: value }))
    setNoteState('saving')
    if (noteTimers.current[k]) clearTimeout(noteTimers.current[k])
    noteTimers.current[k] = setTimeout(() => {
      fetch('/api/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: course.id, moduleKey: k, content: value }),
      }).then(r => setNoteState(r.ok ? 'saved' : 'idle')).catch(() => setNoteState('idle'))
    }, 800)
  }

  function toggleTopic(ti: number) {
    setOpenTopics(prev => {
      const next = new Set(prev)
      if (next.has(ti)) next.delete(ti)
      else next.add(ti)
      return next
    })
  }

  const noteCount = Object.values(notes).filter(v => v?.trim()).length
  const currentNote = notes[currentKey] ?? ''

  return (
    <div className="space-y-6">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900">
        <ArrowLeft className="h-4 w-4" /> All days
      </Link>

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-red-800 to-red-950 px-6 py-7 text-white sm:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider">Day {course.dayNumber}</span>
            <h1 className="font-brand mt-3 text-2xl font-bold sm:text-3xl">{course.title}</h1>
            {course.description && <p className="mt-2 max-w-2xl text-sm text-red-100/80">{course.description}</p>}
          </div>
          {total > 0 && (
            <div className="w-full shrink-0 md:w-56">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-red-100/80">Your progress</span>
                <span className="font-semibold">{readCount}/{total} read</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-white transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Main column */}
        <div className="min-w-0 space-y-6">
          {course.videos.length > 0 && (
            <section className="rounded-2xl border border-zinc-200 bg-white p-5">
              <h2 className="mb-4 text-sm font-semibold text-zinc-900">Videos for this day</h2>
              <Videos videos={course.videos} />
            </section>
          )}

          {current ? (
            <section ref={lessonTop} className="scroll-mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
              <div className="border-b border-zinc-100 px-6 pb-4 pt-5 sm:px-8">
                <p className="text-xs font-medium text-zinc-400">
                  {named && topics[pos.ti].title ? `${topics[pos.ti].title} · ` : ''}Lesson {flatIdx + 1} of {total}
                </p>
                <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <h2 className="text-xl font-semibold text-zinc-900">{current.title}</h2>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {read.has(currentKey) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Read
                      </span>
                    )}
                    <button
                      onClick={() => setShowNote(v => !v)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                        showNote || currentNote.trim() ? 'border-red-200 bg-red-50 text-red-800' : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50',
                      )}
                    >
                      <StickyNote className="h-3.5 w-3.5" /> {currentNote.trim() ? 'My note' : 'Add note'}
                    </button>
                  </div>
                </div>
              </div>

              {showNote && (
                <div className="border-b border-zinc-100 bg-zinc-50 px-6 py-4 sm:px-8">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-medium text-zinc-600">My notes for this lesson (only you can see these)</span>
                    <span className={noteState === 'saved' ? 'text-emerald-600' : 'text-zinc-400'}>
                      {noteState === 'saving' ? 'Saving…' : noteState === 'saved' ? 'Saved' : ''}
                    </span>
                  </div>
                  <textarea
                    value={currentNote}
                    onChange={e => updateNote(currentKey, e.target.value)}
                    placeholder="Write anything you want to remember…"
                    rows={4}
                    className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-red-800/40"
                  />
                </div>
              )}

              {(current.videos ?? []).filter(v => v.url?.trim()).length > 0 && (
                <div className="px-6 pt-6 sm:px-8">
                  <Videos videos={(current.videos ?? []).filter(v => v.url?.trim())} />
                </div>
              )}

              <div className="px-6 py-6 sm:px-8">
                {current.html ? (
                  <div
                    className="text-[15px] leading-7 text-zinc-700 [&_a]:text-red-800 [&_a]:underline [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-zinc-900 [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:font-semibold [&_h3]:text-zinc-900 [&_img]:my-5 [&_img]:block [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl [&_img]:border [&_img]:border-zinc-200 [&_img]:bg-white [&_img]:p-2 [&_img]:shadow-sm [&_li]:pl-1 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-6 [&_p]:mb-4 [&_strong]:font-semibold [&_strong]:text-zinc-900 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6"
                    dangerouslySetInnerHTML={{ __html: current.html }}
                  />
                ) : (
                  <p className="text-sm italic text-zinc-400">No reading for this lesson.</p>
                )}
              </div>

              {/* Previous / next */}
              <div className="flex items-center justify-between gap-4 border-t border-zinc-100 px-6 py-4 sm:px-8">
                {prevItem ? (
                  <button onClick={() => go(prevItem.ti, prevItem.mi)} className="group flex min-w-0 items-center gap-2 text-left text-sm text-zinc-500 hover:text-zinc-900">
                    <ChevronLeft className="h-4 w-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-xs text-zinc-400">Previous</span>
                      <span className="block truncate">{prevItem.title}</span>
                    </span>
                  </button>
                ) : <span />}
                {nextItem ? (
                  <button onClick={() => go(nextItem.ti, nextItem.mi)} className="flex min-w-0 items-center gap-3 rounded-xl bg-red-800 px-4 py-2.5 text-left text-white transition-colors hover:bg-red-900">
                    <span className="min-w-0">
                      <span className="block text-xs text-red-100/80">Next lesson</span>
                      <span className="block max-w-[14rem] truncate text-sm font-medium">{nextItem.title}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  </button>
                ) : quizOpen ? (
                  <Link href={`/quiz/${course.id}`} className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-red-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-900">
                    Go to quiz <ChevronRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <button onClick={finish} className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700">
                    <CheckCircle2 className="h-4 w-4" /> Finish reading
                  </button>
                )}
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-center">
              <BookOpen className="mx-auto mb-2 h-8 w-8 text-zinc-300" />
              <p className="text-sm text-zinc-500">There&apos;s no reading for this day. Go straight to the quiz.</p>
            </section>
          )}

          {/* All notes */}
          {noteCount > 0 && (
            <details className="group rounded-2xl border border-zinc-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-4">
                <span className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                  <StickyNote className="h-4 w-4 text-red-800" /> All my notes
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">{noteCount}</span>
                </span>
                <ChevronDown className="h-4 w-4 text-zinc-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-4 border-t border-zinc-100 px-6 py-4">
                {flat.map(f => {
                  const text = notes[key(f.ti, f.mi)]?.trim()
                  if (!text) return null
                  return (
                    <button key={key(f.ti, f.mi)} onClick={() => go(f.ti, f.mi)} className="block w-full text-left">
                      <p className="text-xs font-medium text-zinc-400">{f.topic ? `${f.topic} · ` : ''}{f.title}</p>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">{text}</p>
                    </button>
                  )
                })}
              </div>
            </details>
          )}
        </div>

        {/* Sidebar: outline + quiz */}
        <aside className="space-y-6 lg:sticky lg:top-6">
          {total > 0 && (
            <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
              <div className="border-b border-zinc-100 px-5 py-4">
                <h2 className="font-semibold text-zinc-900">Day outline</h2>
                <p className="mt-0.5 text-xs text-zinc-400">
                  {named ? `${topics.length} topic${topics.length === 1 ? '' : 's'} · ` : ''}{total} lesson{total === 1 ? '' : 's'}
                </p>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {topics.map((t, ti) => {
                  const topicRead = t.modules.filter((_, mi) => read.has(key(ti, mi))).length
                  const open = !named || openTopics.has(ti)
                  return (
                    <div key={ti} className="border-b border-zinc-100 last:border-b-0">
                      {named && (
                        <button onClick={() => toggleTopic(ti)} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-zinc-50">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-zinc-900">{t.title || `Topic ${ti + 1}`}</span>
                            <span className="text-xs text-zinc-400">{topicRead}/{t.modules.length} read</span>
                          </span>
                          {topicRead === t.modules.length
                            ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                            : <ChevronDown className={cn('h-4 w-4 shrink-0 text-zinc-400 transition-transform', open && 'rotate-180')} />}
                        </button>
                      )}
                      {open && (
                        <ul className="pb-2">
                          {t.modules.map((m, mi) => {
                            const k = key(ti, mi)
                            const active = ti === pos.ti && mi === pos.mi
                            const done = read.has(k)
                            return (
                              <li key={mi}>
                                <button
                                  onClick={() => go(ti, mi)}
                                  className={cn(
                                    'flex w-full items-start gap-3 border-l-[3px] px-5 py-2 text-left text-sm transition-colors',
                                    active ? 'border-red-800 bg-red-50/70 text-red-900' : 'border-transparent text-zinc-600 hover:bg-zinc-50',
                                  )}
                                >
                                  {done
                                    ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                    : <Circle className={cn('mt-0.5 h-4 w-4 shrink-0', active ? 'text-red-800' : 'text-zinc-300')} />}
                                  <span className={cn('min-w-0 flex-1', active && 'font-medium')}>{m.title}</span>
                                  {notes[k]?.trim() && <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />}
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Quiz */}
          <section ref={quizRef} className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', quizOpen ? 'bg-red-50 text-red-800' : 'bg-zinc-100 text-zinc-400')}>
                {quizOpen ? <FileQuestion className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
              </div>
              <div>
                <h2 className="font-semibold text-zinc-900">Day {course.dayNumber} quiz</h2>
                <p className="text-xs text-zinc-400">{quiz.questionCount} questions · pass mark {quiz.passMark}%</p>
              </div>
            </div>

            {quiz.completed ? (
              <p className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <Trophy className="h-4 w-4" /> Passed · best score {quiz.bestScore}%
              </p>
            ) : quiz.attempts > 0 ? (
              <p className="mt-4 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                Best so far {quiz.bestScore}%. You need {quiz.passMark}%{quiz.hasNextDay ? ' to unlock the next day' : ''}.
              </p>
            ) : null}

            {quizOpen ? (
              <Link href={`/quiz/${course.id}`} className="mt-4 block rounded-xl bg-red-800 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-red-900">
                {quiz.completed ? 'Retake quiz' : quiz.attempts > 0 ? 'Try again' : 'Start quiz'}
              </Link>
            ) : (
              <div className="mt-4">
                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                  <div className="h-full rounded-full bg-red-800 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  Read all lessons to unlock the quiz · {total - readCount} left
                </p>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
