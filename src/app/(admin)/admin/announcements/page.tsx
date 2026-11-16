export const dynamic = 'force-dynamic'

import { requireAdmin } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { Announcement } from '@/models/Announcement'
import { User } from '@/models/User'
import { isRealEmail } from '@/lib/email'
import { AnnouncementManager } from '@/components/admin/announcement-manager'

export default async function AnnouncementsPage() {
  await requireAdmin()
  await connectDB()
  const [announcementDocs, employees] = await Promise.all([
    Announcement.find().sort({ createdAt: -1 }).lean(),
    User.find({ role: 'employee' }, { email: 1 }).lean(),
  ])
  const emailable = employees.filter(e => isRealEmail(e.email)).length
  const announcements = announcementDocs.map(a => ({
    id: String(a._id),
    title: a.title,
    body: a.body ?? null,
    expiresAt: a.expiresAt ?? null,
    createdAt: a.createdAt,
    emailedCount: a.emailedCount ?? null,
  }))
  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Announcements</h1>
        <p className="text-zinc-500 text-sm mt-1">Post notices that appear on every employee&apos;s dashboard, and optionally email them</p>
      </div>
      <AnnouncementManager announcements={announcements} employeeCount={employees.length} emailableCount={emailable} />
    </div>
  )
}
