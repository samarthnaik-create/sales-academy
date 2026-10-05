import mongoose, { Schema, Document } from 'mongoose'
export interface IAnnouncement extends Document {
  title: string; body?: string; createdAt: Date; expiresAt?: Date
}
const AnnouncementSchema = new Schema<IAnnouncement>({
  title: { type: String, required: true },
  body: String,
  expiresAt: Date,
}, { timestamps: { createdAt: true, updatedAt: false } })
export const Announcement = mongoose.models.Announcement || mongoose.model<IAnnouncement>('Announcement', AnnouncementSchema)
