import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { requireAdmin } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { User } from '@/models/User'
import { Course } from '@/models/Course'
import { Progress } from '@/models/Progress'

export async function POST(req: NextRequest) {
  try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

  const { name, username, email, password, role } = await req.json()
  if (!name || !username || !password) return NextResponse.json({ error: 'Name, username and password are required' }, { status: 400 })

  const validRole = role === 'admin' ? 'admin' : 'employee'
  const resolvedUsername = username.trim().toLowerCase()
  // Email is optional — generate a placeholder if not provided
  const resolvedEmail = email?.trim() ? email.trim().toLowerCase() : `${resolvedUsername}@noemail.local`

  await connectDB()

  const existing = await User.findOne({ $or: [{ email: resolvedEmail }, { username: resolvedUsername }] }).lean()
  if (existing) return NextResponse.json({ error: 'An account with this username or email already exists' }, { status: 409 })

  const hashed = await bcrypt.hash(password, 12)
  const user = await User.create({ name, username: resolvedUsername, email: resolvedEmail, password: hashed, role: validRole })

  const day1 = await Course.findOne({ dayNumber: 1 }).lean()
  if (day1) await Progress.create({ userId: user._id, courseId: day1._id, unlocked: true })

  return NextResponse.json({ ok: true })
}
