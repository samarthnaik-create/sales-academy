import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { requireAdmin } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { User } from '@/models/User'
import { isId } from '@/lib/validate'

interface Props { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Props) {
  try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  const { id } = await params
  if (!isId(id)) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
  const { password } = await req.json()
  if (typeof password !== 'string' || password.length < 6 || password.length > 200) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  }
  const hashed = await bcrypt.hash(password, 12)
  await connectDB()
  // A reset also lifts any lock from wrong-password attempts
  const updated = await User.findByIdAndUpdate(id, { $set: { password: hashed, failedLogins: 0 }, $unset: { lockUntil: 1 } })
  if (!updated) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
