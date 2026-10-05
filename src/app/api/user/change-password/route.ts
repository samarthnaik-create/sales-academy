import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { User } from '@/models/User'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { currentPassword, newPassword } = await req.json()
  if (!currentPassword || !newPassword) return NextResponse.json({ error: 'Both fields required' }, { status: 400 })
  if (newPassword.length < 6) return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 })

  await connectDB()
  const user = await User.findById(session.user.id).lean()
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const valid = await bcrypt.compare(currentPassword, user.password)
  if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })

  const hash = await bcrypt.hash(newPassword, 12)
  await User.findByIdAndUpdate(user._id, { password: hash })
  return NextResponse.json({ ok: true })
}
