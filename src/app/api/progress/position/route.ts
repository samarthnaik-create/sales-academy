import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { Progress } from '@/models/Progress'

export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { courseId, topicIdx, moduleIdx } = await req.json()
  if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 })

  await connectDB()

  await Progress.findOneAndUpdate(
    { userId: session.user.id, courseId },
    {
      $set: {
        lastTopicIdx: topicIdx ?? 0,
        lastModuleIdx: moduleIdx ?? 0,
        lastVisited: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )

  return NextResponse.json({ ok: true })
}
