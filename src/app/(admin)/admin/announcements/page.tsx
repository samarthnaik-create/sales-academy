import { requireAdmin } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { Announcement } from '@/models/Announcement'
import { AnnouncementManager } from '@/components/admin/announcement-manager'

export default async function AnnouncementsPage() {
  await requireAdmin()
  await connectDB()
  const announcementDocs = await Announcement.find().sort({ createdAt: -1 }).lean()
  const announcements = announcementDocs.map(a => ({
    id: String(a._id),
    title: a.title,
    body: a.body ?? null,
    expiresAt: a.expiresAt ?? null,
    createdAt: a.createdAt,
  }))
  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Announcements</h1>
        <p className="text-zinc-500 text-sm mt-1">Post notices that appear on every employee&apos;s dashboard</p>
      </div>
      <AnnouncementManager announcements={announcements} />
    </div>
  )
}
