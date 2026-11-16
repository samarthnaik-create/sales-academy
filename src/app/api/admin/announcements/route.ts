import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { Announcement } from '@/models/Announcement'
import { User } from '@/models/User'
import { str } from '@/lib/validate'
import { emailConfigured, sendEmail, announcementEmail, isRealEmail } from '@/lib/email'

export const maxDuration = 60

export async function GET() {
  try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  await connectDB()
  const announcements = await Announcement.find().sort({ createdAt: -1 }).lean()
  return NextResponse.json(announcements.map(a => ({ ...a, id: String(a._id) })))
}

// "2026-11-15" from the date picker → shown until the end of that day in India
function endOfDayIST(date: unknown): Date | undefined {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined
  const d = new Date(`${date}T23:59:59.999+05:30`)
  return isNaN(d.getTime()) ? undefined : d
}

export async function POST(req: NextRequest) {
  try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  const input = await req.json()
  const title = str(input.title, 200)
  const body = str(input.body, 5000) || undefined
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  const notify = input.sendEmail === true

  if (notify && !emailConfigured()) {
    return NextResponse.json({ error: 'Email is not set up on the server, so nothing was posted. Untick "Also email" to post without emailing.' }, { status: 500 })
  }

  await connectDB()
  const announcement = await Announcement.create({ title, body, expiresAt: endOfDayIST(input.expiresAt) })

  let email: { sent: number; failed: string[]; noEmail: number } | null = null
  if (notify) {
    const employees = await User.find({ role: 'employee' }, { name: 1, email: 1 }).lean()
    const recipients = employees.filter(e => isRealEmail(e.email))
    const link = `${req.nextUrl.origin}/dashboard`
    email = { sent: 0, failed: [], noEmail: employees.length - recipients.length }

    // One personal email each (nobody sees the others' addresses), a few at a time
    for (let i = 0; i < recipients.length; i += 5) {
      await Promise.all(recipients.slice(i, i + 5).map(async emp => {
        const { subject, html } = announcementEmail(emp.name, title, body, link)
        try {
          await sendEmail(emp.email, subject, html)
          email!.sent++
        } catch (err) {
          console.error('Announcement email failed for', emp.email, err)
          email!.failed.push(emp.name)
        }
      }))
    }
    await Announcement.updateOne({ _id: announcement._id }, { $set: { emailedCount: email.sent } })
  }

  return NextResponse.json({
    ...announcement.toObject(),
    id: String(announcement._id),
    emailedCount: email?.sent,
    email,
  })
}
