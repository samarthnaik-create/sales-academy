'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, XCircle, Loader2, Trophy, ShieldAlert, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MAX_TAB_SWITCHES as MAX_VIOLATIONS, QUIZ_RULES as RULES, PASS_THRESHOLD } from '@/lib/quiz-config'

interface QuizQuestion {
  id: string
  question: string
  options: string[]
  order_index: number
}

interface QuizResult {
  score: number
  passed: boolean
  correctCount: number
  total: number
  correctAnswers: Record<string, string>
  explanations?: Record<string, string>
}

interface Props {
  course: { id: string; title: string; dayNumber: number }
  questions: QuizQuestion[]
  progress: { attempts: number; score: number }
  userId: string
  hasNextDay?: boolean
  // AI quizzes: rules were already accepted, and a retry needs a freshly generated quiz
  skipIntro?: boolean
  onRetry?: () => void
  attemptId?: string // AI quizzes: attempt already recorded by /api/quiz/generate
}

type State = 'intro' | 'taking' | 'submitting' | 'result'

export function QuizEngine({ course, questions, progress, hasNextDay, skipIntro, onRetry, attemptId: initialAttemptId }: Props) {
  const router = useRouter()
  const [state, setState] = useState<State>(skipIntro ? 'taking' : 'intro')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<QuizResult | null>(null)
  const [violations, setViolations] = useState(0)
  const [showWarning, setShowWarning] = useState(false)

  // Use refs so event handlers always see latest values
  const violationsRef = useRef(0)
  const lastViolationTime = useRef(0)
  const answersRef = useRef<Record<string, string>>({})
  const stateRef = useRef<State>(skipIntro ? 'taking' : 'intro')
  const attemptIdRef = useRef<string | undefined>(initialAttemptId)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState('')

  // The attempt counts as soon as the questions are shown
  async function start() {
    setStarting(true)
    setStartError('')
    try {
      const res = await fetch('/api/quiz/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: course.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not start the quiz')
      attemptIdRef.current = data.attemptId
      setState('taking')
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Could not start the quiz')
    } finally {
      setStarting(false)
    }
  }

  useEffect(() => { answersRef.current = answers }, [answers])
  useEffect(() => { stateRef.current = state }, [state])

  const current = questions[currentIndex]
  const total = questions.length
  const answeredCount = Object.keys(answers).length

  const unanswered = questions.map((q, i) => (answers[q.id] ? -1 : i)).filter(i => i >= 0)
  const [confirm, setConfirm] = useState<'unanswered' | 'leave' | null>(null)
  const [submitError, setSubmitError] = useState('')
  const finishedRef = useRef(false) // set once this attempt has been sent for scoring
  const [leftEarly, setLeftEarly] = useState(false)

  async function doSubmit(currentAnswers: Record<string, string>, tabSwitches: number, exited = false) {
    if (finishedRef.current) return
    finishedRef.current = true
    setConfirm(null)
    setSubmitError('')
    setState('submitting')
    try {
      const res = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId: attemptIdRef.current, answers: currentAnswers, tabSwitches, exited }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not submit the quiz')
      setResult(data)
      setLeftEarly(exited)
      setState('result')
    } catch (err) {
      finishedRef.current = false
      setSubmitError(err instanceof Error ? err.message : 'Could not submit the quiz')
      setState('taking')
    }
  }

  // Unanswered questions get a warning first; submitting anyway scores what was answered
  function submit() {
    if (unanswered.length > 0) setConfirm('unanswered')
    else doSubmit(answers, violationsRef.current)
  }

  function selectAnswer(questionId: string, option: string) {
    setAnswers(prev => {
      const next = { ...prev, [questionId]: option }
      answersRef.current = next
      return next
    })
    scheduleSave()
  }

  // Save answers as they go, so leaving midway can still be scored
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (finishedRef.current || !attemptIdRef.current) return
      fetch('/api/quiz/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId: attemptIdRef.current, answers: answersRef.current, tabSwitches: violationsRef.current }),
        keepalive: true,
      }).catch(() => {})
    }, 600)
  }

  // Leaving without submitting (tab closed, refresh, navigating away) scores what was answered.
  // sendBeacon survives the page unloading; the server ignores it if the attempt was already scored.
  function exitQuiz() {
    if (finishedRef.current || stateRef.current !== 'taking' || !attemptIdRef.current) return
    finishedRef.current = true
    const body = JSON.stringify({ attemptId: attemptIdRef.current, answers: answersRef.current, tabSwitches: violationsRef.current, exited: true })
    navigator.sendBeacon('/api/quiz/submit', new Blob([body], { type: 'application/json' }))
  }

  useEffect(() => {
    if (state !== 'taking') return
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault() } // browser's "Leave site?" prompt
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('pagehide', exitQuiz)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('pagehide', exitQuiz)
    }
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  // In-app navigation (sidebar links) unmounts the quiz. The deferred check skips React's
  // dev-mode mount → unmount → remount, which would otherwise end the quiz instantly.
  const mountedRef = useRef(false)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      setTimeout(() => { if (!mountedRef.current) exitQuiz() }, 0)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Tab-switch detection — only active while quiz is being taken
  useEffect(() => {
    if (state !== 'taking') return

    function onViolation() {
      // Debounce: ignore if fired within 1.5 s of last violation
      const now = Date.now()
      if (now - lastViolationTime.current < 1500) return
      lastViolationTime.current = now

      violationsRef.current += 1
      const count = violationsRef.current
      setViolations(count)
      setShowWarning(true)
      scheduleSave() // keep the server's tab-switch count current

      if (count >= MAX_VIOLATIONS) {
        // Auto-submit with whatever has been answered
        doSubmit(answersRef.current, count)
      }
    }

    function onVisibilityChange() {
      if (document.hidden) onViolation()
    }

    function onBlur() {
      // Only count blur if the tab is still visible (i.e. switched to another app/window)
      if (!document.hidden) onViolation()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('blur', onBlur)
    }
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Intro ───────────────────────────────────────────────────
  if (state === 'intro') {
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
          <p className="text-xs text-zinc-400 mb-3">Starting counts as an attempt, even if you leave before submitting.</p>
          {startError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg mb-3">{startError}</div>}
          <button onClick={start} disabled={starting} className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
            {starting ? <><Loader2 className="h-4 w-4 animate-spin" /> Starting…</> : 'I Understand — Start Quiz'}
          </button>
        </div>
      </div>
    )
  }

  // ── Result ──────────────────────────────────────────────────
  if (state === 'result' && result) {
    const { score, passed, correctCount, correctAnswers, explanations } = result
    return (
      <div className="max-w-2xl mx-auto">
        {/* Banner */}
        <div className={cn('rounded-2xl p-6 mb-6 text-white text-center', passed ? 'bg-green-600' : 'bg-red-600')}>
          <div className="text-4xl mb-2">{passed ? '🏆' : '😔'}</div>
          <h2 className="text-xl font-bold mb-1">{passed ? 'Congratulations!' : 'Almost there!'}</h2>
          <p className={passed ? 'text-green-100 text-sm' : 'text-red-100 text-sm'}>
            {passed ? 'You passed and unlocked the next day!' : `You need ${PASS_THRESHOLD}% to pass. Keep going!`}
          </p>
          {Object.keys(answers).length < total && (
            <p className={cn('text-xs mt-1', passed ? 'text-green-100' : 'text-red-100')}>
              {leftEarly ? 'You left the quiz early. ' : ''}Scored on {Object.keys(answers).length} of {total} answered; unanswered questions count as wrong.
            </p>
          )}
          <div className="flex justify-center gap-8 mt-4">
            <div><p className="text-4xl font-bold">{score}%</p><p className="text-xs opacity-80 mt-0.5">Score</p></div>
            <div className="w-px bg-white/30" />
            <div><p className="text-4xl font-bold">{correctCount}/{total}</p><p className="text-xs opacity-80 mt-0.5">Correct</p></div>
          </div>
        </div>

        {/* Review */}
        <div className="space-y-4 mb-6">
          {questions.map((q, i) => {
            const userAns = answers[q.id]
            const correct = correctAnswers[q.id]
            const ok = userAns === correct
            const explanation = explanations?.[q.id]
            return (
              <div key={q.id} className={cn('bg-white rounded-xl border-2 p-4', ok ? 'border-green-200' : 'border-red-200')}>
                <div className="flex items-start gap-2 mb-3">
                  {ok ? <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" /> : <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />}
                  <p className="font-semibold text-sm text-zinc-900">Q{i + 1}. {q.question}</p>
                  {!userAns && <span className="ml-auto shrink-0 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Not answered</span>}
                </div>
                <div className="space-y-2 mb-3 ml-7">
                  {q.options.map((opt, oi) => {
                    const isCorrect = opt === correct
                    const isSelected = opt === userAns
                    return (
                      <div key={oi} className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm border', isCorrect ? 'bg-green-50 border-green-300 text-green-800 font-medium' : isSelected && !isCorrect ? 'bg-red-50 border-red-300 text-red-800' : 'bg-zinc-50 border-zinc-200 text-zinc-400')}>
                        <span className={cn('w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shrink-0', isCorrect ? 'bg-green-500 text-white' : isSelected && !isCorrect ? 'bg-red-500 text-white' : 'bg-zinc-200 text-zinc-500')}>
                          {String.fromCharCode(65 + oi)}
                        </span>
                        {opt}
                        {isCorrect && <span className="ml-auto text-green-600 text-xs font-semibold">✓ Correct</span>}
                        {isSelected && !isCorrect && <span className="ml-auto text-red-500 text-xs">Your answer</span>}
                      </div>
                    )
                  })}
                </div>
                {explanation && (
                  <div className={cn('ml-7 p-3 rounded-lg text-xs leading-relaxed', ok ? 'bg-green-50 text-green-900 border border-green-100' : 'bg-amber-50 text-amber-900 border border-amber-100')}>
                    <span className="font-semibold">💡 </span>{explanation}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-center pb-8">
          {passed ? (
            <>
              {hasNextDay && <button onClick={() => router.push(`/day/${course.dayNumber + 1}`)} className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">Next Day →</button>}
              <button onClick={() => router.push('/dashboard')} className="border border-zinc-300 text-zinc-700 hover:bg-zinc-50 text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
                {hasNextDay ? 'Dashboard' : '🎉 Back to Dashboard'}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => {
                if (onRetry) return onRetry()
                setAnswers({}); setCurrentIndex(0); setResult(null)
                violationsRef.current = 0; setViolations(0); setShowWarning(false)
                attemptIdRef.current = undefined; finishedRef.current = false; setLeftEarly(false)
                setState('intro')
              }} className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">Retry Quiz</button>
              <button onClick={() => router.push(`/day/${course.dayNumber}`)} className="border border-zinc-300 text-zinc-700 hover:bg-zinc-50 text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">Review Lesson</button>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Taking ──────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto">
      {/* Tab-switch warning overlay */}
      {showWarning && violations < MAX_VIOLATIONS && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border-2 border-amber-400 shadow-2xl p-7 max-w-sm mx-4 text-center">
            <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-7 w-7 text-amber-600" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 mb-1">Tab Switch Detected!</h3>
            <p className="text-sm text-zinc-500 mb-4">
              You left the quiz window. This has been recorded.
            </p>
            <div className="flex items-center justify-center gap-1.5 mb-5">
              {Array.from({ length: MAX_VIOLATIONS }).map((_, i) => (
                <div key={i} className={cn('w-8 h-2 rounded-full', i < violations ? 'bg-amber-500' : 'bg-zinc-200')} />
              ))}
            </div>
            <p className="text-xs text-zinc-400 mb-5">
              Warning <span className="font-bold text-amber-600">{violations}</span> of {MAX_VIOLATIONS} —{' '}
              {MAX_VIOLATIONS - violations === 1
                ? <span className="text-red-500 font-semibold">one more switch will auto-submit your quiz!</span>
                : <span>{MAX_VIOLATIONS - violations} more switches will auto-submit your quiz.</span>}
            </p>
            <button
              onClick={() => setShowWarning(false)}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors">
              I understand — Continue Quiz
            </button>
          </div>
        </div>
      )}

      {/* Auto-submit overlay */}
      {showWarning && violations >= MAX_VIOLATIONS && state === 'submitting' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border-2 border-red-400 shadow-2xl p-7 max-w-sm mx-4 text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="h-7 w-7 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 mb-2">Quiz Auto-Submitted</h3>
            <p className="text-sm text-zinc-500 mb-4">
              You switched tabs {violations} times. Your quiz has been automatically submitted and your admin has been notified.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
            </div>
          </div>
        </div>
      )}

      {/* Submit with unanswered questions / leave the quiz */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border-2 border-amber-400 shadow-2xl p-7 max-w-sm mx-4 text-center">
            <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-7 w-7 text-amber-600" />
            </div>
            {confirm === 'unanswered' ? (
              <>
                <h3 className="text-lg font-bold text-zinc-900 mb-1">
                  {unanswered.length} question{unanswered.length > 1 ? 's' : ''} not answered
                </h3>
                <p className="text-sm text-zinc-500 mb-4">Unanswered questions count as wrong. Tap one to go back to it.</p>
                <div className="flex flex-wrap justify-center gap-1.5 mb-5">
                  {unanswered.map(i => (
                    <button key={i} onClick={() => { setCurrentIndex(i); setConfirm(null) }}
                      className="min-w-9 h-8 px-2 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors">
                      Q{i + 1}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-zinc-900 mb-1">Leave the quiz?</h3>
                <p className="text-sm text-zinc-500 mb-5">
                  Your quiz will be submitted now and scored on the {answeredCount} of {total} questions you answered. Unanswered questions count as wrong.
                </p>
              </>
            )}
            <div className="flex gap-2">
              <button onClick={() => setConfirm(null)}
                className="flex-1 border border-zinc-300 text-zinc-700 hover:bg-zinc-50 font-semibold py-2.5 rounded-lg text-sm transition-colors">
                {confirm === 'unanswered' ? 'Go back' : 'Stay'}
              </button>
              <button onClick={() => doSubmit(answers, violationsRef.current, confirm === 'leave')}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors">
                {confirm === 'unanswered' ? 'Submit anyway' : 'Leave & submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mb-6">
        <button onClick={() => setConfirm('leave')} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Leave Quiz
        </button>
        {violations > 0 && (
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
            <AlertTriangle className="h-3 w-3" />
            {violations} tab switch{violations > 1 ? 'es' : ''} detected
          </div>
        )}
      </div>

      <div className="mb-5">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-lg font-bold text-zinc-900">{course.title} — Quiz</h1>
          <span className="text-xs text-zinc-400">{answeredCount}/{total} answered</span>
        </div>
        <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
          <div className="h-full bg-red-600 rounded-full transition-all" style={{ width: `${(answeredCount / total) * 100}%` }} />
        </div>
        <p className="text-zinc-400 text-xs mt-1">Pass score: {PASS_THRESHOLD}% · Unlimited retries</p>
      </div>

      {/* Question card */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6 mb-4">
        <div className="mb-2">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Question {currentIndex + 1} of {total}</span>
        </div>
        <p className="text-zinc-900 font-semibold mt-2 mb-5 leading-snug">{current.question}</p>
        <div className="space-y-3">
          {current.options.map((opt, i) => {
            const selected = answers[current.id] === opt
            return (
              <button key={i} onClick={() => selectAnswer(current.id, opt)}
                className={cn('w-full text-left px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all',
                  selected ? 'border-blue-500 bg-blue-50 text-zinc-900' : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-700')}>
                <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded-full text-xs mr-3 shrink-0', selected ? 'bg-blue-600 text-white font-bold' : 'bg-zinc-100 text-zinc-500')}>
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </button>
            )
          })}
        </div>
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => setCurrentIndex(i => i - 1)} disabled={currentIndex === 0} className="text-sm text-zinc-500 hover:text-zinc-900 disabled:opacity-30 border border-zinc-200 px-4 py-2 rounded-lg transition-colors">← Prev</button>

        <div className="flex gap-1.5">
          {questions.map((q, i) => (
            <button key={q.id} onClick={() => setCurrentIndex(i)}
              className={cn('w-7 h-7 rounded-full text-xs font-medium transition-colors',
                i === currentIndex ? 'bg-blue-600 text-white' : answers[q.id] ? 'bg-blue-100 text-blue-700' : 'bg-zinc-100 text-zinc-500')}>
              {i + 1}
            </button>
          ))}
        </div>

        {currentIndex < total - 1
          ? <button onClick={() => setCurrentIndex(i => i + 1)} className="text-sm text-zinc-500 hover:text-zinc-900 border border-zinc-200 px-4 py-2 rounded-lg transition-colors">Next →</button>
          : <button onClick={submit} disabled={state === 'submitting'}
              className="text-sm font-medium bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg transition-colors flex items-center gap-2">
              {state === 'submitting' ? <><Loader2 className="h-4 w-4 animate-spin" />Submitting…</> : 'Submit Quiz'}
            </button>
        }
      </div>

      {submitError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg mt-4 text-center">{submitError}</div>
      )}

      {progress.attempts > 0 && (
        <p className="text-center text-zinc-400 text-xs mt-4">Previous best: {progress.score}% · Attempt #{progress.attempts + 1}</p>
      )}
    </div>
  )
}
