import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { requireAdmin } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { User } from '@/models/User'
import { Course } from '@/models/Course'
import { Progress } from '@/models/Progress'
import { str } from '@/lib/validate'

export async function POST(req: NextRequest) {
  try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

  const body = await req.json()
  const name = str(body.name, 100)
  const resolvedUsername = str(body.username, 50)?.toLowerCase().replace(/\s+/g, ' ')
  const email = str(body.email, 200)?.toLowerCase()
  const password = body.password
  if (!name || !resolvedUsername || typeof password !== 'string' || !password) {
    return NextResponse.json({ error: 'Name, username and password are required' }, { status: 400 })
  }
  // Login treats anything containing @ as an email, so a username with @ could never sign in
  if (resolvedUsername.includes('@')) {
    return NextResponse.json({ error: 'Username cannot contain "@". Put the email address in the Email field instead.' }, { status: 400 })
  }
  if (password.length < 6 || password.length > 200) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Email address looks wrong' }, { status: 400 })

  const validRole = body.role === 'admin' ? 'admin' : 'employee'
  // Email is optional — generate a placeholder if not provided
  const resolvedEmail = email || `${resolvedUsername}@noemail.local`

  await connectDB()

  const existing = await User.findOne({ $or: [{ email: resolvedEmail }, { username: resolvedUsername }] }).lean()
  if (existing) return NextResponse.json({ error: 'An account with this username or email already exists' }, { status: 409 })

  const hashed = await bcrypt.hash(password, 12)
  const user = await User.create({ name, username: resolvedUsername, email: resolvedEmail, password: hashed, role: validRole })

  const day1 = await Course.findOne({ dayNumber: 1 }).lean()
  if (day1) await Progress.create({ userId: user._id, courseId: day1._id, unlocked: true })

  return NextResponse.json({ ok: true })
}
