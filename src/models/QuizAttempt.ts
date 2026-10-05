import mongoose, { Schema, Document } from 'mongoose'
export interface IQuizAttempt extends Document {
  userId: mongoose.Types.ObjectId; courseId: mongoose.Types.ObjectId; score: number; passed: boolean; answers: Record<string, string>; createdAt: Date
}
const QuizAttemptSchema = new Schema<IQuizAttempt>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  score: { type: Number, required: true },
  passed: { type: Boolean, required: true },
  answers: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: true, updatedAt: false } })
export const QuizAttempt = mongoose.models.QuizAttempt || mongoose.model<IQuizAttempt>('QuizAttempt', QuizAttemptSchema)
