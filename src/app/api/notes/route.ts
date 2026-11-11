import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { Note } from '@/models/Note'
import { isId } from '@/lib/validate'

const MAX_NOTE_LENGTH = 20_000

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const courseId = req.nextUrl.searchParams.get('courseId')
  if (!isId(courseId)) return NextResponse.json({ error: 'courseId required' }, { status: 400 })

  await connectDB()
  const notes = await Note.find(
    { userId: session.user.id, courseId },
    { moduleKey: 1, content: 1, updatedAt: 1 }
  ).lean()

  return NextResponse.json({ notes })
}

export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { courseId, content } = body
  const moduleKey = typeof body.moduleKey === 'number' ? String(body.moduleKey) : body.moduleKey
  if (!isId(courseId) || typeof moduleKey !== 'string' || !moduleKey || moduleKey.length > 100) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  if (content !== undefined && content !== null && typeof content !== 'string') return NextResponse.json({ error: 'Invalid note' }, { status: 400 })
  if (typeof content === 'string' && content.length > MAX_NOTE_LENGTH) {
    return NextResponse.json({ error: `Notes are limited to ${MAX_NOTE_LENGTH.toLocaleString()} characters` }, { status: 400 })
  }

  await connectDB()

  if (!content?.trim()) {
    // Delete empty notes to keep things clean
    await Note.deleteMany({ userId: session.user.id, courseId, moduleKey })
    return NextResponse.json({ ok: true })
  }

  await Note.findOneAndUpdate(
    { userId: session.user.id, courseId, moduleKey },
    { $set: { content } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  )

  return NextResponse.json({ ok: true })
}
