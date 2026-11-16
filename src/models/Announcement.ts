import mongoose, { Schema, Document } from 'mongoose'
export interface IAnnouncement extends Document {
  title: string; body?: string; createdAt: Date; expiresAt?: Date; emailedCount?: number
}
const AnnouncementSchema = new Schema<IAnnouncement>({
  title: { type: String, required: true },
  body: String,
  expiresAt: Date,
  emailedCount: Number,
}, { timestamps: { createdAt: true, updatedAt: false } })
export const Announcement = mongoose.models.Announcement || mongoose.model<IAnnouncement>('Announcement', AnnouncementSchema)
