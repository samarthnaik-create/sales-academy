'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, Lock } from 'lucide-react'
import { PASS_THRESHOLD } from '@/lib/quiz-config'

export interface DayCard {
  id: string
  dayNumber: number
  title: string
  description: string | null
  unlocked: boolean
  completed: boolean
  score: number      // best score so far
  attempts: number
  visited: boolean   // opened the lesson at least once
}

interface Props {
  firstName: string
  completed: number
  total: number
  resume: { dayNumber: number; title: string; position: string | null } | null
  days: DayCard[]
  children?: React.ReactNode // announcements and deadline, shown between the header and the list
}

type Tab = 'all' | 'progress' | 'done'

function status(d: DayCard) {
  if (d.completed) return { label: `Completed · best score ${d.score}%`, pct: 100, tone: 'done' as const }
  if (!d.unlocked) return { label: 'Locked', pct: 0, tone: 'locked' as const }
  if (d.attempts > 0) return { label: `Quiz attempted · best ${d.score}% (need ${PASS_THRESHOLD}%)`, pct: d.score, tone: 'active' as const }
  if (d.visited) return { label: 'Lesson started · quiz not attempted yet', pct: 30, tone: 'active' as const }
  return { label: 'Not started', pct: 0, tone: 'active' as const }
}

export function DashboardHome({ firstName, completed, total, resume, days, children }: Props) {
  const [tab, setTab] = useState<Tab>('all')
  const pct = total ? Math.round((completed / total) * 100) : 0
  const allDone = total > 0 && completed >= total

  const inProgress = days.filter(d => d.unlocked && !d.completed)
  const done = days.filter(d => d.completed)
  const shown = tab === 'progress' ? inProgress : tab === 'done' ? done : days

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'all', label: 'All days', count: days.length },
    { id: 'progress', label: 'In progress', count: inProgress.length },
    { id: 'done', label: 'Completed', count: done.length },
  ]

  return (
    <div className="space-y-6">
      {/* Header band */}
      <div className="overflow-hidden rounded-2xl bg-red-600 text-white">
        <div className="flex flex-col gap-6 px-6 pb-6 pt-8 sm:px-8 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-brand text-3xl font-bold md:text-4xl">Hi {firstName}!</h1>
            <p className="mt-2 text-sm text-red-100">
              {allDone ? `You've completed all ${total} days. Well done!` : `${completed} of ${total} days completed`}
            </p>
            <div className="mt-3 h-1.5 w-full max-w-56 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
            </div>
          </div>
          {resume && !allDone && (
            <Link
              href={`/day/${resume.dayNumber}`}
              className="group inline-flex max-w-full items-center gap-3 self-start rounded-xl bg-white px-4 py-3 text-zinc-900 transition-shadow hover:shadow-lg md:self-auto"
            >
              <div className="min-w-0">
                <p className="text-xs text-zinc-500">Continue where you left off</p>
                <p className="truncate text-sm font-semibold">Day {resume.dayNumber} · {resume.title}</p>
                {resume.position && <p className="truncate text-xs text-zinc-400">{resume.position}</p>}
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-red-600 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
        <div className="flex gap-5 overflow-x-auto px-6 sm:gap-6 sm:px-8">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 whitespace-nowrap border-b-[3px] pb-3 text-sm font-medium transition-colors ${
                tab === t.id ? 'border-white text-white' : 'border-transparent text-red-100 hover:text-white'
              }`}
            >
              {t.label} <span className="opacity-70">({t.count})</span>
            </button>
          ))}
        </div>
      </div>

      {children}

      {/* Day cards */}
      {shown.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white py-12 text-center text-sm text-zinc-400">
          {tab === 'done' ? 'No days completed yet' : tab === 'progress' ? 'Nothing in progress' : 'No training days yet'}
        </p>
      ) : (
        <div className="space-y-4">
          {shown.map(d => {
            const s = status(d)
            const locked = s.tone === 'locked'
            return (
              <div
                key={d.id}
                className={`flex flex-col gap-5 rounded-2xl border bg-white p-4 transition-shadow sm:flex-row ${
                  locked ? 'border-zinc-100' : 'border-zinc-200 hover:shadow-md'
                }`}
              >
                {/* Day tile */}
                <div className={`relative flex h-28 shrink-0 flex-col justify-end overflow-hidden rounded-xl p-4 sm:h-auto sm:w-44 ${
                  locked ? 'bg-zinc-100 text-zinc-400'
                    : d.completed ? 'bg-red-50 text-red-700'
                    : 'bg-gradient-to-br from-red-600 to-red-700 text-white'
                }`}>
                  {!locked && !d.completed && <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />}
                  <span className="text-xs font-semibold uppercase tracking-widest opacity-80">Day</span>
                  <span className="font-brand text-4xl font-bold leading-none">{d.dayNumber}</span>
                  {d.completed && <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-green-600" />}
                  {locked && <Lock className="absolute right-3 top-3 h-4 w-4" />}
                </div>

                {/* Details */}
                <div className="flex min-w-0 flex-1 flex-col py-1">
                  <h3 className={`text-lg font-semibold ${locked ? 'text-zinc-400' : 'text-zinc-900'}`}>{d.title}</h3>
                  {d.description && <p className="mt-0.5 line-clamp-1 text-sm text-zinc-500">{d.description}</p>}

                  <div className="mt-4">
                    <p className={`text-xs ${s.tone === 'done' ? 'text-green-700' : 'text-zinc-500'}`}>{s.label}</p>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className={`h-full rounded-full ${s.tone === 'done' ? 'bg-green-500' : 'bg-red-600'}`}
                        style={{ width: `${s.pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    {locked ? (
                      <p className="text-xs text-zinc-400">Pass Day {d.dayNumber - 1} to unlock</p>
                    ) : d.completed ? (
                      <Link href={`/day/${d.dayNumber}`} className="inline-flex items-center rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50">
                        Review
                      </Link>
                    ) : (
                      <Link href={`/day/${d.dayNumber}`} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700">
                        {d.visited || d.attempts > 0 ? 'Continue' : 'Start day'} <ArrowRight className="h-4 w-4" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
