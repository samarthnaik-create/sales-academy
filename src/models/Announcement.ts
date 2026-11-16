import mongoose, { Schema, Document } from 'mongoose'
export interface IAnnouncement extends Document {
  title: string; body?: string; createdAt: Date; expiresAt?: Date; emailedCount?: number
  audience?: mongoose.Types.ObjectId[] // empty or missing = every employee
}
const AnnouncementSchema = new Schema<IAnnouncement>({
  title: { type: String, required: true },
  body: String,
  expiresAt: Date,
  emailedCount: Number,
  audience: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: undefined },
}, { timestamps: { createdAt: true, updatedAt: false } })
export const Announcement = mongoose.models.Announcement || mongoose.model<IAnnouncement>('Announcement', AnnouncementSchema)
