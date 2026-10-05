'use client'
import { useState } from 'react'
import { Sparkles, Loader2, ShieldAlert } from 'lucide-react'
import { QuizEngine } from './quiz-engine'

const RULES = [
  'No switching tabs, no minimising, no second screens.',
  'No Google, no ChatGPT, no AI assistants, no notes.',
  'Answer in your own words. The AI grader catches copy-paste.',
  'Tab switches are detected, logged and shown to your admin.',
  'Sit straight, focus on this screen only. This is your test.',
]

interface Props {
  course: { id: string; title: string; dayNumber: number }
  progress: { attempts: number; score: number }
  userId: string
  hasNextDay?: boolean
}

export function AiQuizStarter({ course, progress, userId, hasNextDay }: Props) {
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [questions, setQuestions] = useState<{ id: string; question: string; options: string[]; order_index: number }[] | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function generate() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: course.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setQuestions(data.questions)
      setSessionId(data.sessionId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate quiz')
    } finally {
      setLoading(false)
    }
  }

  if (questions && sessionId) {
    return <QuizEngine course={course} questions={questions} progress={progress} userId={userId} sessionId={sessionId} hasNextDay={hasNextDay} />
  }

  if (!accepted) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl border-2 border-red-200 p-7">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-zinc-900">Before You Begin</h2>
              <p className="text-zinc-400 text-xs">Read and accept the exam conditions</p>
            </div>
          </div>
          <ul className="space-y-3 mb-8">
            {RULES.map((rule, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-zinc-700">
                <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                {rule}
              </li>
            ))}
          </ul>
          <button onClick={() => setAccepted(true)} className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
            I Understand — Start Quiz
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white rounded-2xl border border-zinc-200 p-10 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-red-100">
          <Sparkles className="h-7 w-7 text-white" />
        </div>
        <h2 className="text-xl font-bold text-zinc-900 mb-2">AI-Generated Quiz</h2>
        <p className="text-zinc-500 text-sm mb-1">Gemini AI will generate <strong>10 unique questions</strong> just for you.</p>
        <p className="text-zinc-400 text-xs mb-8">Every attempt gives different questions — no two employees see the same quiz.</p>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">{error}</div>}

        <button onClick={generate} disabled={loading} className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-medium px-6 py-2.5 rounded-lg text-sm flex items-center gap-2 mx-auto transition-colors">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Generating…</> : <><Sparkles className="h-4 w-4" />Generate My Quiz</>}
        </button>
        {loading && <p className="text-zinc-400 text-xs mt-3">This takes about 5–10 seconds…</p>}
      </div>
    </div>
  )
}
