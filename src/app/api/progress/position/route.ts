import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { Progress } from '@/models/Progress'
import { isId } from '@/lib/validate'

const index = (v: unknown) => Math.min(1000, Math.max(0, Math.floor(Number(v)) || 0))

export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { courseId, topicIdx, moduleIdx, read } = await req.json()
  if (!isId(courseId)) return NextResponse.json({ error: 'courseId required' }, { status: 400 })

  const readKeys = Array.isArray(read) ? read.filter((k: unknown): k is string => typeof k === 'string' && /^\d{1,4}-\d{1,4}$/.test(k)).slice(0, 500) : []

  await connectDB()

  await Progress.findOneAndUpdate(
    { userId: session.user.id, courseId },
    {
      $set: {
        lastTopicIdx: index(topicIdx),
        lastModuleIdx: index(moduleIdx),
        lastVisited: new Date(),
      },
      // Modules read so far ("topic-module" keys), kept across visits
      ...(readKeys.length ? { $addToSet: { readModules: { $each: readKeys } } } : {}),
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  )

  return NextResponse.json({ ok: true })
}
