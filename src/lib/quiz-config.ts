export const MIN_QUESTIONS = 5
export const MAX_QUESTIONS = 30
export const DEFAULT_QUESTIONS = 10

export function clampQuestionCount(n: unknown): number {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v)) return DEFAULT_QUESTIONS
  return Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, v))
}
