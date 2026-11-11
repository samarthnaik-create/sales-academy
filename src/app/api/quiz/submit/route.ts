import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { finalizeAttempt } from '@/lib/quiz-attempt'

// Finishes the attempt started by /api/quiz/start or /api/quiz/generate.
// Used by the Submit button and, with exited: true, when the employee leaves midway (sent via sendBeacon).
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { attemptId, answers, tabSwitches, exited } = await req.json() as { attemptId?: string; answers?: unknown; tabSwitches?: unknown; exited?: boolean }
  if (!attemptId) return NextResponse.json({ error: 'Please reload the page and start the quiz again' }, { status: 400 })

  const result = await finalizeAttempt(attemptId, session.user.id, { answers, tabSwitches, exited: Boolean(exited) })
  if (!result) return NextResponse.json({ error: 'This attempt was already submitted' }, { status: 400 })

  return NextResponse.json(result)
}
