import mongoose from 'mongoose'

export const isId = (v: unknown): v is string => typeof v === 'string' && mongoose.isValidObjectId(v)

export const str = (v: unknown, max = 10_000): string | undefined =>
  typeof v === 'string' ? v.trim().slice(0, max) : undefined

export interface QuizInput { question: string; options: string[]; answer: string }

// Keeps only well-formed questions whose answer is one of the options
export function cleanQuizzes(raw: unknown): QuizInput[] | null {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw)) return null
  const out: QuizInput[] = []
  for (const q of raw) {
    if (!q || typeof q !== 'object') return null
    const { question, options, answer } = q as Record<string, unknown>
    const text = str(question, 2000)
    const opts = Array.isArray(options) ? options.map(o => str(o, 500)).filter((o): o is string => !!o) : []
    const ans = str(answer, 500)
    if (!text || opts.length < 2 || !ans || !opts.includes(ans)) return null
    out.push({ question: text, options: opts, answer: ans })
  }
  return out
}

export function parseDayNumber(v: unknown): number | null {
  const n = Number(v)
  return Number.isInteger(n) && n >= 1 && n <= 365 ? n : null
}
