'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, CheckCircle2, FileQuestion, BookOpen, FolderOpen, StickyNote, X, PenLine } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Module { title: string; html: string }
interface TopicGroup { title: string; modules: Module[] }

interface Props {
  content: string
  courseId: string
  dayNumber: number
  quizCount: number
  completed: boolean
  bestScore: number
}

function parseTopics(content: string): TopicGroup[] {
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed) && parsed.length > 0) {
      if ('modules' in parsed[0] && Array.isArray((parsed[0] as TopicGroup).modules)) return parsed as TopicGroup[]
      if ('html' in parsed[0]) return [{ title: '', modules: parsed as Module[] }]
    }
  } catch {}
  return [{ title: '', modules: [{ title: 'Lesson', html: content }] }]
}

export function LessonViewer({ content, courseId, dayNumber, quizCount, completed, bestScore }: Props) {
  const topics = parseTopics(content)
  const multiTopic = topics.length > 1 || (topics.length === 1 && topics[0].title !== '')

  const [topicIdx, setTopicIdx] = useState(0)
  const [moduleIdx, setModuleIdx] = useState(0)
  const [readModules, setReadModules] = useState<Set<string>>(new Set())

  // Notes
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [noteSaving, setNoteSaving] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [showNote, setShowNote] = useState(false)
  const [showAllNotes, setShowAllNotes] = useState(false)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const currentTopic = topics[topicIdx]
  const currentModules = currentTopic?.modules ?? []
  const currentModule = currentModules[moduleIdx]
  const isLastModule = moduleIdx === currentModules.length - 1
  const isLastTopic = topicIdx === topics.length - 1
  const isVeryLast = isLastModule && isLastTopic
  const isFirst = topicIdx === 0 && moduleIdx === 0

  const totalModules = topics.reduce((sum, t) => sum + t.modules.length, 0)
  const currentFlatIdx = topics.slice(0, topicIdx).reduce((sum, t) => sum + t.modules.length, 0) + moduleIdx

  function moduleKey(ti: number, mi: number) { return `${ti}-${mi}` }
  const currentKey = moduleKey(topicIdx, moduleIdx)

  // Load notes on mount
  useEffect(() => {
    fetch(`/api/notes?courseId=${courseId}`)
      .then(r => r.json())
      .then(data => {
        const map: Record<string, string> = {}
        for (const n of (data.notes ?? [])) map[n.moduleKey] = n.content
        setNotes(map)
      })
  }, [courseId])

  // Track position on navigation (debounced 1.5s)
  const positionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (positionTimer.current) clearTimeout(positionTimer.current)
    positionTimer.current = setTimeout(() => {
      fetch('/api/progress/position', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, topicIdx, moduleIdx }),
      })
    }, 1500)
    return () => { if (positionTimer.current) clearTimeout(positionTimer.current) }
  }, [courseId, topicIdx, moduleIdx])

  function updateNote(key: string, value: string) {
    setNotes(prev => ({ ...prev, [key]: value }))
    setNoteSaving('saving')
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key])
    saveTimers.current[key] = setTimeout(() => {
      fetch('/api/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, moduleKey: key, content: value }),
      }).then(() => setNoteSaving('saved'))
    }, 800)
  }

  function markRead(ti: number, mi: number) {
    setReadModules(prev => new Set([...prev, moduleKey(ti, mi)]))
  }

  function isTopicFullyRead(ti: number) {
    return topics[ti].modules.every((_, mi) => readModules.has(moduleKey(ti, mi)))
  }

  const allRead = topics.every((_, ti) => isTopicFullyRead(ti))

  function goToTopic(ti: number) {
    markRead(topicIdx, moduleIdx)
    setTopicIdx(ti)
    setModuleIdx(0)
    setShowNote(false)
  }

  function goToModule(mi: number) {
    markRead(topicIdx, moduleIdx)
    setModuleIdx(mi)
    setShowNote(false)
  }

  function next() {
    markRead(topicIdx, moduleIdx)
    if (!isLastModule) setModuleIdx(m => m + 1)
    else if (!isLastTopic) { setTopicIdx(t => t + 1); setModuleIdx(0) }
    setShowNote(false)
  }

  function prev() {
    if (moduleIdx > 0) setModuleIdx(m => m - 1)
    else if (topicIdx > 0) {
      const prevTopic = topics[topicIdx - 1]
      setTopicIdx(t => t - 1)
      setModuleIdx(Math.max(0, prevTopic.modules.length - 1))
    }
    setShowNote(false)
  }

  // Count notes that have content
  const totalNoteCount = Object.values(notes).filter(v => v?.trim()).length
  const currentNoteContent = notes[currentKey] ?? ''
  const currentHasNote = !!currentNoteContent.trim()

  return (
    <div className="space-y-4">
      {/* Topic tabs */}
      {multiTopic && (
        <div className="flex gap-1.5 flex-wrap">
          {topics.map((t, ti) => {
            const topicRead = isTopicFullyRead(ti)
            return (
              <button key={ti} onClick={() => goToTopic(ti)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  topicIdx === ti ? 'bg-red-600 text-white'
                    : topicRead ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                )}>
                {topicRead ? <CheckCircle2 className="h-3 w-3" /> : <FolderOpen className="h-3 w-3" />}
                {t.title || `Topic ${ti + 1}`}
              </button>
            )
          })}
        </div>
      )}

      {/* Module tabs within current topic */}
      {currentModules.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          {currentModules.map((m, mi) => {
            const isRead = readModules.has(moduleKey(topicIdx, mi))
            const hasNote = !!(notes[moduleKey(topicIdx, mi)]?.trim())
            return (
              <button key={mi} onClick={() => goToModule(mi)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1',
                  moduleIdx === mi ? 'bg-zinc-800 text-white'
                    : isRead ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                )}>
                {isRead && <CheckCircle2 className="h-3 w-3" />}
                {mi + 1}. {m.title}
                {hasNote && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Has notes" />}
              </button>
            )
          })}
        </div>
      )}

      {/* Content card */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="h-4 w-4 text-red-600 shrink-0" />
            <span className="font-semibold text-sm text-zinc-900 truncate">{currentModule?.title}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            {totalModules > 1 && (
              <span className="text-xs text-zinc-400">{currentFlatIdx + 1} / {totalModules}</span>
            )}
            <button
              onClick={() => setShowNote(v => !v)}
              title="My notes for this module"
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors',
                showNote ? 'bg-amber-100 text-amber-700' : currentHasNote ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100'
              )}>
              <StickyNote className="h-3.5 w-3.5" />
              {currentHasNote ? 'Notes' : 'Add note'}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {totalModules > 1 && (
          <div className="h-1 bg-zinc-100">
            <div className="h-full bg-red-600 transition-all" style={{ width: `${((currentFlatIdx + 1) / totalModules) * 100}%` }} />
          </div>
        )}

        {/* Content */}
        <div className="px-6 py-5">
          {currentModule?.html ? (
            <div
              className="text-sm text-zinc-700 leading-relaxed [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-zinc-900 [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-zinc-800 [&_h3]:mt-3 [&_h3]:mb-1.5 [&_p]:mb-3 [&_p]:text-zinc-600 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_ol]:space-y-1.5 [&_li]:text-zinc-600 [&_strong]:font-semibold [&_strong]:text-zinc-900 [&_em]:italic"
              dangerouslySetInnerHTML={{ __html: currentModule.html }}
            />
          ) : (
            <p className="text-sm text-zinc-400 italic">No content for this module.</p>
          )}
        </div>

        {/* Notes panel */}
        {showNote && (
          <div className="border-t border-amber-100 bg-amber-50/60 px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <PenLine className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-xs font-semibold text-amber-700">My Notes</span>
              </div>
              <span className={cn(
                'text-[10px] font-medium transition-colors',
                noteSaving === 'saving' ? 'text-amber-500' : noteSaving === 'saved' ? 'text-green-600' : 'text-zinc-400'
              )}>
                {noteSaving === 'saving' ? 'Saving…' : noteSaving === 'saved' ? 'Saved ✓' : ''}
              </span>
            </div>
            <textarea
              value={currentNoteContent}
              onChange={e => updateNote(currentKey, e.target.value)}
              placeholder="Type your notes for this module…"
              rows={4}
              className="w-full text-sm text-zinc-800 bg-white border border-amber-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none placeholder:text-zinc-400"
            />
          </div>
        )}

        {/* Navigation */}
        <div className="px-5 py-4 border-t border-zinc-100 flex items-center justify-between">
          <button onClick={prev} disabled={isFirst}
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 disabled:opacity-30 transition-colors">
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>

          {!isVeryLast ? (
            <button onClick={next}
              className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              {isLastModule && !isLastTopic ? <>Next Topic <ChevronRight className="h-4 w-4" /></> : <>Next <ChevronRight className="h-4 w-4" /></>}
            </button>
          ) : (
            <button onClick={() => markRead(topicIdx, moduleIdx)}
              className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <CheckCircle2 className="h-4 w-4" /> Mark as Read
            </button>
          )}
        </div>
      </div>

      {/* All Notes panel (if any notes exist) */}
      {totalNoteCount > 0 && (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <button
            onClick={() => setShowAllNotes(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-zinc-50 transition-colors">
            <div className="flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-amber-500" />
              <span className="font-semibold text-sm text-zinc-900">My Notes</span>
              <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">{totalNoteCount} module{totalNoteCount > 1 ? 's' : ''}</span>
            </div>
            {showAllNotes ? <X className="h-4 w-4 text-zinc-400" /> : <ChevronRight className="h-4 w-4 text-zinc-400" />}
          </button>

          {showAllNotes && (
            <div className="border-t border-zinc-100 px-5 py-4 space-y-4 max-h-80 overflow-y-auto">
              {topics.map((topic, ti) =>
                topic.modules.map((mod, mi) => {
                  const key = moduleKey(ti, mi)
                  const noteContent = notes[key]?.trim()
                  if (!noteContent) return null
                  return (
                    <div key={key}>
                      <p className="text-xs font-semibold text-zinc-400 mb-1">
                        {multiTopic && topic.title ? `${topic.title} · ` : ''}{mod.title}
                      </p>
                      <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">{noteContent}</p>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* Quiz card */}
      <div className={cn('bg-white rounded-xl border p-5 transition-all', allRead ? 'border-zinc-200' : 'border-zinc-100 opacity-60')}>
        <div className="flex items-center gap-3 mb-4">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', allRead ? 'bg-red-50' : 'bg-zinc-50')}>
            <FileQuestion className={cn('h-4 w-4', allRead ? 'text-red-600' : 'text-zinc-300')} />
          </div>
          <div>
            <p className="font-semibold text-sm text-zinc-900">Quiz</p>
            <p className="text-xs text-zinc-400">
              {allRead
                ? `${quizCount > 0 ? quizCount + ' questions' : 'AI-generated'} · Pass 80% to unlock next day`
                : `Read all ${totalModules} module${totalModules !== 1 ? 's' : ''} to unlock the quiz`}
            </p>
          </div>
        </div>

        {completed && (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2 mb-4">
            <CheckCircle2 className="h-4 w-4" /> Completed · Best score: {bestScore}%
          </div>
        )}

        {allRead ? (
          <Link href={`/quiz/${courseId}`}
            className="block text-center bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
            {completed ? 'Retake Quiz' : 'Start Quiz'}
          </Link>
        ) : (
          <div className="text-center text-sm text-zinc-400 py-2 bg-zinc-50 rounded-lg">
            Finish reading to unlock
          </div>
        )}
      </div>
    </div>
  )
}
