import mongoose, { Schema, Document } from 'mongoose'
export interface IQuiz extends Document {
  courseId: mongoose.Types.ObjectId; question: string; options: string[]; answer: string; order: number
}
const QuizSchema = new Schema<IQuiz>({
  courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  question: { type: String, required: true },
  options: [String],
  answer: { type: String, required: true },
  order: { type: Number, default: 0 },
})
QuizSchema.index({ courseId: 1, order: 1 })
export const Quiz = mongoose.models.Quiz || mongoose.model<IQuiz>('Quiz', QuizSchema)
