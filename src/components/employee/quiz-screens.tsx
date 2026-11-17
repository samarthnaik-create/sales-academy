'use client'
import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { QUIZ_RULES } from '@/lib/quiz-config'

// Rules shown before every quiz (manual and AI)
export function QuizRules({ dayNumber, note, error, onStart }: {
  dayNumber: number
  note?: string
  error?: string
  onStart: () => void
}) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-zinc-200 bg-white p-7">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-800">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Day {dayNumber} quiz</p>
          <h2 className="text-lg font-semibold text-zinc-900">Before you begin</h2>
        </div>
      </div>
      <ol className="mb-6 space-y-3">
        {QUIZ_RULES.map((rule, i) => (
          <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-zinc-700">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">{i + 1}</span>
            {rule}
          </li>
        ))}
      </ol>
      {note && <p className="mb-3 text-xs text-zinc-400">{note}</p>}
      {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <button
        onClick={onStart}
        className="w-full rounded-xl bg-red-800 py-3 text-sm font-medium text-white transition-[background-color,transform] hover:bg-red-900 active:scale-[0.98]"
      >
        I understand, start the quiz
      </button>
    </div>
  )
}

// Spinner screen while the quiz is prepared; long waits (AI) rotate status lines so it never looks stuck
export function QuizLoading({ title = 'Preparing your quiz…', steps, hint }: { title?: string; steps?: string[]; hint?: string }) {
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (!steps || steps.length < 2) return
    const t = setInterval(() => setStep(s => Math.min(s + 1, steps.length - 1)), 5000)
    return () => clearInterval(t)
  }, [steps])

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-zinc-200 bg-white px-8 py-14 text-center" role="status" aria-live="polite">
      <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-zinc-100 border-t-red-800" />
      <h2 className="mt-6 text-lg font-semibold text-zinc-900">{title}</h2>
      {steps && <p key={step} className="animate-fade mt-2 text-sm text-zinc-500">{steps[step]}</p>}
      {hint && <p className="mt-4 text-xs text-zinc-400">{hint}</p>}
    </div>
  )
}
