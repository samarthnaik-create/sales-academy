import mongoose, { Schema, Document } from 'mongoose'
export interface INote extends Document {
  userId: mongoose.Types.ObjectId; courseId: mongoose.Types.ObjectId; moduleKey: string; content: string; updatedAt: Date; createdAt: Date
}
const NoteSchema = new Schema<INote>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  moduleKey: { type: String, required: true },
  content: { type: String, required: true },
}, { timestamps: true })
NoteSchema.index({ userId: 1, courseId: 1, moduleKey: 1 }, { unique: true })
export const Note = mongoose.models.Note || mongoose.model<INote>('Note', NoteSchema)
