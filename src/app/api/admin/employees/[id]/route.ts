import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { User } from '@/models/User'
import { Progress } from '@/models/Progress'
import { QuizAttempt } from '@/models/QuizAttempt'
import { Note } from '@/models/Note'
import { EmailLog } from '@/models/EmailLog'
import { isId, parseEmployeeFields } from '@/lib/validate'

// Edit an employee's name, username or email
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  const { id } = await params
  if (!isId(id)) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
  const fields = parseEmployeeFields(await req.json())
  if (!fields.ok) return NextResponse.json({ error: fields.error }, { status: 400 })
  const { name, username, email } = fields

  await connectDB()
  if (!(await User.exists({ _id: id }))) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
  const taken = await User.findOne({ _id: { $ne: id }, $or: [{ username }, { email }] }, { username: 1 }).lean()
  if (taken) {
    return NextResponse.json({ error: taken.username === username ? 'That username is already used by someone else' : 'That email is already used by someone else' }, { status: 409 })
  }
  await User.updateOne({ _id: id }, { $set: { name, username, email } })
  return NextResponse.json({ ok: true, name, username, email })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let admin
  try { admin = await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  const { id } = await params
  if (!isId(id)) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
  if (id === admin.id) return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
  await connectDB()
  await User.findByIdAndDelete(id)
  // Remove everything that belonged to this person (their login stops working immediately)
  await Promise.all([
    Progress.deleteMany({ userId: id }),
    QuizAttempt.deleteMany({ userId: id }),
    Note.deleteMany({ userId: id }),
    EmailLog.deleteMany({ userId: id }),
  ])
  return NextResponse.json({ ok: true })
}
