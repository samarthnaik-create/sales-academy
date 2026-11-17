'use client'
import { useState } from 'react'
import { QuizEngine } from './quiz-engine'
import { QuizRules, QuizLoading } from './quiz-screens'

interface Props {
  course: { id: string; title: string; dayNumber: number }
  totalQuestions: number
  progress: { attempts: number; score: number }
  userId: string
  hasNextDay?: boolean
}

const STEPS = [
  'Reading today’s lesson…',
  'Writing your questions…',
  'Checking every answer…',
  'Shuffling the questions…',
  'Almost ready…',
]

export function AiQuizStarter({ course, totalQuestions, progress, userId, hasNextDay }: Props) {
  const [loading, setLoading] = useState(false)
  const [questions, setQuestions] = useState<{ id: string; question: string; options: string[]; order_index: number }[] | null>(null)
  const [attemptId, setAttemptId] = useState<string | null>(null)
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
      setAttemptId(data.attemptId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to prepare the quiz')
    } finally {
      setLoading(false)
    }
  }

  if (questions && attemptId) {
    return (
      <QuizEngine
        course={course} questions={questions} progress={progress} userId={userId} hasNextDay={hasNextDay}
        skipIntro
        attemptId={attemptId}
        // Each attempt gets freshly generated questions
        onRetry={() => { setQuestions(null); setAttemptId(null); generate() }}
      />
    )
  }

  if (loading) {
    const wait = totalQuestions > 20 ? 'up to a minute' : totalQuestions > 10 ? 'about 15–30 seconds' : 'about 10–15 seconds'
    return (
      <QuizLoading
        title={`Preparing your ${totalQuestions} questions`}
        steps={STEPS}
        hint={`This takes ${wait}. Please stay on this page.`}
      />
    )
  }

  return (
    <QuizRules
      dayNumber={course.dayNumber}
      note={`${totalQuestions} questions, freshly written for you each attempt. Starting counts as an attempt, even if you leave before submitting.`}
      error={error}
      onStart={generate}
    />
  )
}
