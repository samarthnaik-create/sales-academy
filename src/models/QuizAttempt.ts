import mongoose, { Schema, Document } from 'mongoose'
export interface IQuizAttempt extends Document {
  userId: mongoose.Types.ObjectId; courseId: mongoose.Types.ObjectId; score: number; passed: boolean; answers: Record<string, string>; tabSwitches: number
  // 'started' = questions shown, not finished yet. Older records have no status and were all submitted.
  status?: 'started' | 'submitted'; submittedAt?: Date
  exited?: boolean // finished by leaving the quiz rather than pressing Submit
  key?: Record<string, string>; explanations?: Record<string, string> // server-only answer key, so the attempt can be scored later
  createdAt: Date
}
const QuizAttemptSchema = new Schema<IQuizAttempt>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  score: { type: Number, required: true },
  passed: { type: Boolean, required: true },
  answers: { type: Schema.Types.Mixed, default: {} },
  tabSwitches: { type: Number, default: 0 },
  status: { type: String, default: 'submitted' },
  submittedAt: Date,
  exited: Boolean,
  key: Schema.Types.Mixed,
  explanations: Schema.Types.Mixed,
}, { timestamps: { createdAt: true, updatedAt: false } })
export const QuizAttempt = mongoose.models.QuizAttempt || mongoose.model<IQuizAttempt>('QuizAttempt', QuizAttemptSchema)

export const isSubmitted = (a: { status?: string }) => a.status !== 'started'
