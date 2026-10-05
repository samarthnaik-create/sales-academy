import mongoose, { Schema, Document } from 'mongoose'
export interface IProgress extends Document {
  userId: mongoose.Types.ObjectId; courseId: mongoose.Types.ObjectId; unlocked: boolean; completed: boolean; score: number; attempts: number; completedAt?: Date; lastTopicIdx: number; lastModuleIdx: number; lastVisited?: Date
}
const ProgressSchema = new Schema<IProgress>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  unlocked: { type: Boolean, default: false },
  completed: { type: Boolean, default: false },
  score: { type: Number, default: 0 },
  attempts: { type: Number, default: 0 },
  completedAt: Date,
  lastTopicIdx: { type: Number, default: 0 },
  lastModuleIdx: { type: Number, default: 0 },
  lastVisited: Date,
})
ProgressSchema.index({ userId: 1, courseId: 1 }, { unique: true })
export const Progress = mongoose.models.Progress || mongoose.model<IProgress>('Progress', ProgressSchema)
