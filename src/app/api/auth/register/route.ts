import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/mongoose'
import { User } from '@/models/User'
import { Course } from '@/models/Course'
import { Progress } from '@/models/Progress'

export async function POST(req: NextRequest) {
  const { name, username, email, password } = await req.json()

  if (!name || !username || !email || !password) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  if (!/^[a-z0-9_]+$/.test(username)) {
    return NextResponse.json({ error: 'Invalid username format' }, { status: 400 })
  }

  await connectDB()

  const existing = await User.findOne({
    $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }],
  }).lean()
  if (existing) {
    return NextResponse.json({ error: 'Email or username already taken' }, { status: 409 })
  }

  const hashed = await bcrypt.hash(password, 12)
  const user = await User.create({
    name,
    username: username.toLowerCase(),
    email: email.toLowerCase(),
    password: hashed,
  })

  // Unlock day 1
  const day1 = await Course.findOne({ dayNumber: 1 }).lean()
  if (day1) {
    await Progress.create({ userId: user._id, courseId: day1._id, unlocked: true })
  }

  return NextResponse.json({ ok: true })
}
