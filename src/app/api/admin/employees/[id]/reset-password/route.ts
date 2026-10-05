import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { requireAdmin } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { User } from '@/models/User'

interface Props { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Props) {
  try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  const { id } = await params
  const { password } = await req.json()
  if (!password || password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  const hashed = await bcrypt.hash(password, 12)
  await connectDB()
  await User.findByIdAndUpdate(id, { password: hashed })
  return NextResponse.json({ ok: true })
}
