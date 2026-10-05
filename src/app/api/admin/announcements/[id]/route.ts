import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { Announcement } from '@/models/Announcement'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  const { id } = await params
  await connectDB()
  await Announcement.findByIdAndDelete(id)
  return NextResponse.json({ ok: true })
}
