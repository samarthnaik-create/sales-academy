export const dynamic = 'force-dynamic'

import { requireAdmin } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { Announcement } from '@/models/Announcement'
import { User } from '@/models/User'
import { isRealEmail } from '@/lib/email'
import { AnnouncementManager } from '@/components/admin/announcement-manager'
import { PageHeader } from '@/components/ui/page-header'

export default async function AnnouncementsPage() {
  await requireAdmin()
  await connectDB()
  const [announcementDocs, employees] = await Promise.all([
    Announcement.find().sort({ createdAt: -1 }).lean(),
    User.find({ role: 'employee' }, { name: 1, email: 1 }).sort({ name: 1 }).lean(),
  ])
  const people = employees.map(e => ({ id: String(e._id), name: e.name, hasEmail: isRealEmail(e.email) }))
  const nameById = Object.fromEntries(people.map(p => [p.id, p.name]))
  const announcements = announcementDocs.map(a => ({
    id: String(a._id),
    title: a.title,
    body: a.body ?? null,
    expiresAt: a.expiresAt ?? null,
    createdAt: a.createdAt,
    emailedCount: a.emailedCount ?? null,
    // Names it was sent to; null = everyone
    audience: a.audience?.length ? a.audience.map((id: unknown) => nameById[String(id)] ?? 'Removed employee') : null,
  }))
  return (
    <div className="space-y-6">
      <PageHeader title="Announcements" subtitle="Post notices on employees' dashboards, and optionally email them" />
      <AnnouncementManager announcements={announcements} employees={people} />
    </div>
  )
}
