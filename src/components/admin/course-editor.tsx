'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Upload, Loader2, ChevronLeft, ChevronRight, FolderOpen, FileText } from 'lucide-react'
import Link from 'next/link'
import { RichTextEditor } from '@/components/ui/rich-text-editor'

interface Quiz { id?: string; question: string; options: string[]; answer: string; order: number }
interface Module { title: string; html: string }
interface TopicGroup { title: string; modules: Module[] }
interface VideoEntry { title: string; url: string }
interface Course { id: string; title: string; description: string | null; dayNumber: number; videoUrl: string | null; videos: string | null; content: string | null; aiTopup: boolean; quizzes: Quiz[] }

function parseVideos(raw: string | null, legacyUrl: string | null): VideoEntry[] {
  if (raw) {
    try { const p = JSON.parse(raw); if (Array.isArray(p)) return p } catch {}
  }
  if (legacyUrl) return [{ title: '', url: legacyUrl }]
  return []
}

function parseTopics(content: string | null): TopicGroup[] {
  if (!content) return []
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed) && parsed.length > 0) {
      if ('modules' in parsed[0] && Array.isArray((parsed[0] as TopicGroup).modules)) return parsed as TopicGroup[]
      if ('html' in parsed[0]) return [{ title: 'Lesson Content', modules: parsed as Module[] }]
    }
  } catch {}
  return [{ title: 'Lesson Content', modules: [{ title: 'Lesson', html: content }] }]
}

export function CourseEditor({ course }: { course: Course | null }) {
  const router = useRouter()
  const isNew = !course

  const [form, setForm] = useState({
    title: course?.title ?? '',
    description: course?.description ?? '',
    dayNumber: course?.dayNumber ?? 1,
  })
  const [videos, setVideos] = useState<VideoEntry[]>(parseVideos(course?.videos ?? null, course?.videoUrl ?? null))
  const [topics, setTopics] = useState<TopicGroup[]>(parseTopics(course?.content ?? null))
  const [activeTopic, setActiveTopic] = useState(0)
  const [activeModule, setActiveModule] = useState(0)
  const [quizzes, setQuizzes] = useState<Quiz[]>(course?.quizzes ?? [])
  const [aiTopup, setAiTopup] = useState<boolean>(course?.aiTopup ?? false)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([])
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentTopic = topics[activeTopic]
  const currentModule = currentTopic?.modules[activeModule]

  // Upload multiple Word docs — each becomes a new topic
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setUploading(true)
    setError('')
    setUploadingFiles(files.map(f => f.name))

    const newTopics: TopicGroup[] = []
    for (const file of files) {
      const fd = new FormData()
      fd.append('file', file)
      try {
        const res = await fetch('/api/admin/extract-doc', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok) { setError(`Failed to process "${file.name}": ${data.error || 'Unknown error'}`); continue }
        const topicTitle = file.name.replace(/\.(docx?|doc)$/i, '').replace(/[-_]/g, ' ').trim()
        newTopics.push({ title: topicTitle, modules: data.modules as Module[] })
      } catch {
        setError(`Failed to read "${file.name}"`)
      }
    }

    if (newTopics.length > 0) {
      setTopics(prev => {
        const updated = [...prev, ...newTopics]
        setActiveTopic(updated.length - newTopics.length)
        setActiveModule(0)
        return updated
      })
    }

    setUploading(false)
    setUploadingFiles([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function addTopic() {
    const idx = topics.length
    setTopics(prev => [...prev, { title: `Topic ${prev.length + 1}`, modules: [] }])
    setActiveTopic(idx)
    setActiveModule(0)
  }

  function removeTopic(i: number) {
    if (!confirm('Delete this topic and all its modules?')) return
    setTopics(prev => prev.filter((_, idx) => idx !== i))
    setActiveTopic(t => Math.min(t, Math.max(0, topics.length - 2)))
    setActiveModule(0)
  }

  function updateTopicTitle(i: number, title: string) {
    setTopics(prev => prev.map((t, idx) => idx === i ? { ...t, title } : t))
  }

  function addModule() {
    const ti = activeTopic
    setTopics(prev => {
      const updated = prev.map((t, i) =>
        i === ti ? { ...t, modules: [...t.modules, { title: `Module ${t.modules.length + 1}`, html: '' }] } : t
      )
      setActiveModule(updated[ti].modules.length - 1)
      return updated
    })
  }

  function removeModule(mi: number) {
    const ti = activeTopic
    setTopics(prev => prev.map((t, i) =>
      i === ti ? { ...t, modules: t.modules.filter((_, idx) => idx !== mi) } : t
    ))
    setActiveModule(m => Math.max(0, m - 1))
  }

  function updateModule(mi: number, field: keyof Module, value: string) {
    const ti = activeTopic
    setTopics(prev => prev.map((t, i) =>
      i === ti ? { ...t, modules: t.modules.map((m, idx) => idx === mi ? { ...m, [field]: value } : m) } : t
    ))
  }

  function addQuestion() {
    setQuizzes(prev => [...prev, { question: '', options: ['', '', '', ''], answer: '', order: prev.length }])
  }
  function removeQuestion(i: number) { setQuizzes(prev => prev.filter((_, idx) => idx !== i)) }
  function updateQuestion(i: number, field: keyof Quiz, value: string | string[]) {
    setQuizzes(prev => prev.map((q, idx) => idx === i ? { ...q, [field]: value } : q))
  }
  function updateOption(qi: number, oi: number, value: string) {
    setQuizzes(prev => prev.map((q, idx) => idx === qi ? { ...q, options: q.options.map((o, i) => i === oi ? value : o) } : q))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const content = topics.length > 0 ? JSON.stringify(topics) : null
    const validVideos = videos.filter(v => v.url.trim())
    const res = await fetch(`/api/admin/courses${isNew ? '' : `/${course!.id}`}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, content, quizzes, aiTopup, videos: JSON.stringify(validVideos) }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || 'Failed'); return }
    router.push('/admin/courses')
    router.refresh()
  }

  async function deleteCourse() {
    if (!confirm('Delete this course?')) return
    await fetch(`/api/admin/courses/${course!.id}`, { method: 'DELETE' })
    router.push('/admin/courses')
    router.refresh()
  }

  const totalModules = topics.reduce((sum, t) => sum + t.modules.length, 0)

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <Link href="/admin/courses" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Courses
        </Link>
        {!isNew && (
          <button onClick={deleteCourse} className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1.5 transition-colors">
            <Trash2 className="h-4 w-4" /> Delete Course
          </button>
        )}
      </div>

      <h1 className="text-2xl font-bold text-zinc-900 mb-6">{isNew ? 'New Course' : 'Edit Course'}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Course details */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
          <h2 className="font-semibold text-zinc-900">Course Details</h2>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Day Number</label>
            <input type="number" min={1} max={30} value={form.dayNumber} onChange={e => setForm(p => ({ ...p, dayNumber: parseInt(e.target.value) }))} required className="w-full px-3 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent" />
          </div>

          {/* Videos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-zinc-700">Videos (optional)</label>
              <button type="button" onClick={() => setVideos(v => [...v, { title: '', url: '' }])}
                className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium transition-colors">
                <Plus className="h-3.5 w-3.5" /> Add Video
              </button>
            </div>
            {videos.length === 0 ? (
              <p className="text-xs text-zinc-400 py-2">No videos added — click "Add Video" to add YouTube, Vimeo or Google Drive links</p>
            ) : (
              <div className="space-y-2">
                {videos.map((v, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={v.title}
                        onChange={e => setVideos(prev => prev.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x))}
                        placeholder="Title (optional)"
                        className="px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                      <input
                        type="url"
                        value={v.url}
                        onChange={e => setVideos(prev => prev.map((x, idx) => idx === i ? { ...x, url: e.target.value } : x))}
                        placeholder="https://youtube.com/... or drive.google.com/..."
                        className="col-span-2 px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                    <button type="button" onClick={() => setVideos(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-zinc-300 hover:text-red-500 transition-colors pt-2 shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Title</label>
            <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required placeholder="e.g. The Four Sales Roles" className="w-full px-3 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Description</label>
            <input type="text" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Short description shown on day card" className="w-full px-3 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent" />
          </div>
        </div>

        {/* Topics + Modules */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-zinc-900">Lesson Content</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                {topics.length === 0
                  ? 'Upload Word docs or add topics manually'
                  : `${topics.length} topic${topics.length > 1 ? 's' : ''} · ${totalModules} module${totalModules !== 1 ? 's' : ''} total`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.doc"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 border border-red-200 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {uploading
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Processing…</>
                  : <><Upload className="h-3.5 w-3.5" />Upload Word Docs</>}
              </button>
              <button
                type="button"
                onClick={addTopic}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 border border-zinc-200 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add Topic
              </button>
            </div>
          </div>

          {/* Upload progress */}
          {uploading && uploadingFiles.length > 0 && (
            <div className="mb-4 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
              <p className="text-xs font-medium text-red-700 mb-1">Processing {uploadingFiles.length} file{uploadingFiles.length > 1 ? 's' : ''}…</p>
              {uploadingFiles.map((name, i) => (
                <p key={i} className="text-xs text-red-500 flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin shrink-0" /> {name}
                </p>
              ))}
            </div>
          )}

          {topics.length === 0 ? (
            <div className="text-center py-12 text-zinc-400 text-sm border-2 border-dashed border-zinc-200 rounded-xl">
              <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="font-medium">No content yet</p>
              <p className="text-xs mt-1">Upload one or more Word docs, or add topics manually</p>
              <p className="text-xs mt-1 text-zinc-300">Each Word doc becomes a topic with its subtopics as modules</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Topic tabs */}
              <div className="flex gap-1.5 flex-wrap border-b border-zinc-100 pb-3">
                {topics.map((t, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { setActiveTopic(i); setActiveModule(0) }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTopic === i ? 'bg-red-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
                  >
                    <FolderOpen className="h-3 w-3" />
                    {t.title || `Topic ${i + 1}`}
                    <span className={`text-[10px] ${activeTopic === i ? 'text-red-200' : 'text-zinc-400'}`}>
                      ({t.modules.length})
                    </span>
                  </button>
                ))}
              </div>

              {/* Active topic editor */}
              {currentTopic && (
                <div className="space-y-3">
                  {/* Topic title row */}
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-red-500 shrink-0" />
                    <input
                      type="text"
                      value={currentTopic.title}
                      onChange={e => updateTopicTitle(activeTopic, e.target.value)}
                      placeholder="Topic title"
                      className="flex-1 font-semibold text-sm text-zinc-900 border-b border-zinc-200 focus:border-red-400 outline-none pb-0.5"
                    />
                    <button
                      type="button"
                      onClick={() => removeTopic(activeTopic)}
                      className="text-zinc-300 hover:text-red-500 transition-colors shrink-0 ml-1"
                      title="Delete topic"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Module tabs for this topic */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {currentTopic.modules.map((m, mi) => (
                      <button
                        key={mi}
                        type="button"
                        onClick={() => setActiveModule(mi)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${activeModule === mi ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
                      >
                        <FileText className="h-3 w-3" />
                        {mi + 1}. {m.title || `Module ${mi + 1}`}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={addModule}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-red-600 hover:text-red-700 border border-dashed border-red-200 hover:border-red-300 transition-colors"
                    >
                      <Plus className="h-3 w-3" /> Add Module
                    </button>
                  </div>

                  {/* No modules empty state */}
                  {currentTopic.modules.length === 0 && (
                    <div className="text-center py-6 text-zinc-400 text-xs border border-dashed border-zinc-200 rounded-xl">
                      No modules in this topic yet — click "Add Module" above
                    </div>
                  )}

                  {/* Active module editor */}
                  {currentModule && (
                    <div className="border border-zinc-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-zinc-400 shrink-0" />
                        <input
                          type="text"
                          value={currentModule.title}
                          onChange={e => updateModule(activeModule, 'title', e.target.value)}
                          placeholder="Module title"
                          className="flex-1 font-medium text-sm text-zinc-900 border-b border-zinc-200 focus:border-red-400 outline-none pb-0.5"
                        />
                        <button
                          type="button"
                          onClick={() => removeModule(activeModule)}
                          className="text-zinc-300 hover:text-red-500 transition-colors shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <RichTextEditor
                        value={currentModule.html}
                        onChange={val => updateModule(activeModule, 'html', val)}
                        placeholder="Type your lesson content here..."
                      />
                    </div>
                  )}

                  {/* Nav hint */}
                  {currentTopic.modules.length > 1 && (
                    <div className="flex items-center justify-between pt-0.5 text-xs text-zinc-400">
                      <span>Module {activeModule + 1} of {currentTopic.modules.length} in this topic</span>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => setActiveModule(m => Math.max(0, m - 1))} disabled={activeModule === 0} className="p-1 rounded hover:bg-zinc-100 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                        <button type="button" onClick={() => setActiveModule(m => Math.min(currentTopic.modules.length - 1, m + 1))} disabled={activeModule === currentTopic.modules.length - 1} className="p-1 rounded hover:bg-zinc-100 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quiz questions */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-zinc-900">Quiz Questions</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                {quizzes.length === 0 ? 'Leave empty — AI generates all 10 questions' : `${quizzes.length} manual question${quizzes.length > 1 ? 's' : ''} added`}
              </p>
            </div>
            <button type="button" onClick={addQuestion} className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 font-medium transition-colors">
              <Plus className="h-4 w-4" /> Add Question
            </button>
          </div>

          {/* AI top-up checkbox */}
          <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors mb-4 ${aiTopup ? 'border-red-400 bg-red-50' : 'border-zinc-200 hover:border-zinc-300'}`}>
            <input
              type="checkbox"
              checked={aiTopup}
              onChange={e => setAiTopup(e.target.checked)}
              className="mt-0.5 accent-red-600 w-4 h-4 shrink-0"
            />
            <div>
              <p className="text-sm font-medium text-zinc-900">Fill remaining questions with AI</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {quizzes.length === 0
                  ? 'AI will generate all 10 questions from the lesson content'
                  : quizzes.length >= 10
                  ? 'You already have 10 or more questions — AI top-up not needed'
                  : `AI will generate ${10 - quizzes.length} more question${10 - quizzes.length > 1 ? 's' : ''} to reach a total of 10. All questions will be shuffled.`}
              </p>
            </div>
          </label>

          {quizzes.length === 0 && (
            <div className="text-center py-8 text-zinc-400 text-sm border-2 border-dashed border-zinc-200 rounded-xl">
              No manual questions — {aiTopup ? 'AI will generate all 10' : 'add questions above or enable AI top-up'}
            </div>
          )}

          <div className="space-y-6">
            {quizzes.map((q, qi) => (
              <div key={qi} className="border border-zinc-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-zinc-400 uppercase">Question {qi + 1}</span>
                  <button type="button" onClick={() => removeQuestion(qi)} className="text-zinc-400 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
                </div>
                <input type="text" value={q.question} onChange={e => updateQuestion(qi, 'question', e.target.value)} placeholder="Question text?" required className="w-full px-3 py-2.5 border border-zinc-300 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent" />
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {q.options.map((opt, oi) => (
                    <input key={oi} type="text" value={opt} onChange={e => updateOption(qi, oi, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + oi)}`} required className="px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent" />
                  ))}
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Correct Answer</label>
                  <select value={q.answer} onChange={e => updateQuestion(qi, 'answer', e.target.value)} required className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent">
                    <option value="">Select correct answer</option>
                    {q.options.filter(Boolean).map((opt, oi) => <option key={oi} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

        <div className="flex gap-3">
          <Link href="/admin/courses" className="flex-1 text-center border border-zinc-300 text-zinc-700 py-2.5 rounded-lg text-sm hover:bg-zinc-50 transition-colors">Cancel</Link>
          <button type="submit" disabled={loading} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
            {loading ? 'Saving…' : isNew ? 'Create Course' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
