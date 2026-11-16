import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { requireAdmin } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { User } from '@/models/User'
import { Course } from '@/models/Course'
import { Progress } from '@/models/Progress'
import { parseEmployeeFields } from '@/lib/validate'

export async function POST(req: NextRequest) {
  try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

  const body = await req.json()
  const fields = parseEmployeeFields(body)
  if (!fields.ok) return NextResponse.json({ error: fields.error }, { status: 400 })
  const { name, username: resolvedUsername, email: resolvedEmail } = fields
  const password = body.password
  if (typeof password !== 'string' || password.length < 6 || password.length > 200) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  }
  const validRole = body.role === 'admin' ? 'admin' : 'employee'

  await connectDB()

  const existing = await User.findOne({ $or: [{ email: resolvedEmail }, { username: resolvedUsername }] }).lean()
  if (existing) return NextResponse.json({ error: 'An account with this username or email already exists' }, { status: 409 })

  const hashed = await bcrypt.hash(password, 12)
  const user = await User.create({ name, username: resolvedUsername, email: resolvedEmail, password: hashed, role: validRole })

  const day1 = await Course.findOne({ dayNumber: 1 }).lean()
  if (day1) await Progress.create({ userId: user._id, courseId: day1._id, unlocked: true })

  return NextResponse.json({ ok: true })
}
