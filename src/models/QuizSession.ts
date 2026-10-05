import mongoose, { Schema } from 'mongoose'

export interface IQuizSession {
  _id: string; courseId: string; userId: string; answers: Record<string, string>; explanations: Record<string, string>; expiresAt: Date; createdAt: Date
}
const QuizSessionSchema = new Schema<IQuizSession>({
  _id: { type: String },
  courseId: { type: String, required: true },
  userId: { type: String, required: true },
  answers: { type: Schema.Types.Mixed, default: {} },
  explanations: { type: Schema.Types.Mixed, default: {} },
  expiresAt: { type: Date, required: true },
}, { timestamps: { createdAt: true, updatedAt: false }, _id: false })
export const QuizSession = mongoose.models.QuizSession || mongoose.model<IQuizSession>('QuizSession', QuizSessionSchema)
