import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { Note } from '@/models/Note'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const courseId = req.nextUrl.searchParams.get('courseId')
  if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 })

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

  const { courseId, moduleKey, content } = await req.json()
  if (!courseId || moduleKey === undefined) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  await connectDB()

  if (!content?.trim()) {
    // Delete empty notes to keep things clean
    await Note.deleteMany({ userId: session.user.id, courseId, moduleKey })
    return NextResponse.json({ ok: true })
  }

  await Note.findOneAndUpdate(
    { userId: session.user.id, courseId, moduleKey },
    { $set: { content } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )

  return NextResponse.json({ ok: true })
}
