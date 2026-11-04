export const MIN_QUESTIONS = 5
export const MAX_QUESTIONS = 30
export const DEFAULT_QUESTIONS = 10
const WORDS_PER_QUESTION = 150

export function clampQuestionCount(n: unknown): number {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v)) return DEFAULT_QUESTIONS
  return Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, v))
}

export function suggestQuestionCount(wordCount: number): number {
  return clampQuestionCount(Math.round(wordCount / WORDS_PER_QUESTION))
}
