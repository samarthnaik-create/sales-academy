import mongoose, { Schema, Document } from 'mongoose'
import { DEFAULT_QUESTIONS } from '@/lib/quiz-config'
export interface ICourse extends Document {
  title: string; description?: string; dayNumber: number; videoUrl?: string; videos?: string; content?: string; aiTopup: boolean; questionCount: number; createdAt: Date
}
const CourseSchema = new Schema<ICourse>({
  title: { type: String, required: true },
  description: String,
  dayNumber: { type: Number, required: true, unique: true },
  videoUrl: String,
  videos: String,
  content: String,
  aiTopup: { type: Boolean, default: false },
  questionCount: { type: Number, default: DEFAULT_QUESTIONS },
}, { timestamps: { createdAt: true, updatedAt: false } })
export const Course = mongoose.models.Course || mongoose.model<ICourse>('Course', CourseSchema)
