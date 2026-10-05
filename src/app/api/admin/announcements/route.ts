import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { Announcement } from '@/models/Announcement'

export async function GET() {
  try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  await connectDB()
  const announcements = await Announcement.find().sort({ createdAt: -1 }).lean()
  return NextResponse.json(announcements.map(a => ({ ...a, id: String(a._id) })))
}

export async function POST(req: NextRequest) {
  try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  const { title, body, expiresAt } = await req.json()
  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  await connectDB()
  const announcement = await Announcement.create({
    title: title.trim(),
    body: body?.trim() || undefined,
    expiresAt: expiresAt ? new Date(expiresAt) : undefined,
  })
  return NextResponse.json({ ...announcement.toObject(), id: String(announcement._id) })
}
