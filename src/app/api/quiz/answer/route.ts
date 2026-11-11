import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { saveAnswers } from '@/lib/quiz-attempt'

// Saves answers as the employee goes, so leaving midway can still be scored
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { attemptId, answers, tabSwitches } = await req.json() as { attemptId?: string; answers?: unknown; tabSwitches?: unknown }
  const ok = attemptId ? await saveAnswers(attemptId, session.user.id, answers, tabSwitches) : false
  if (!ok) return NextResponse.json({ error: 'Attempt not open' }, { status: 400 })
  return NextResponse.json({ ok: true })
}
