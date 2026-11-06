export const MIN_QUESTIONS = 5
export const MAX_QUESTIONS = 30
export const DEFAULT_QUESTIONS = 10
export const MAX_TAB_SWITCHES = 3

export const QUIZ_RULES = [
  'No switching tabs, no minimising, no second screens.',
  'No Google, no ChatGPT, no AI assistants, no notes.',
  `Leaving the quiz is detected and logged for your admin. ${MAX_TAB_SWITCHES} switches auto-submit your quiz.`,
  'Unanswered questions count as wrong, so answer every one.',
  'Sit straight, focus on this screen only. This is your test.',
]

export function clampQuestionCount(n: unknown): number {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v)) return DEFAULT_QUESTIONS
  return Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, v))
}
