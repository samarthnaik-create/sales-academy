import mongoose, { Schema, Document } from 'mongoose'
export interface IEmailLog extends Document {
  userId: mongoose.Types.ObjectId; kind: 'quiz-warning' | 'quiz-overdue'; deadline: Date; createdAt: Date
}
// One row per email sent, so each deadline gets at most one warning and one overdue email
const EmailLogSchema = new Schema<IEmailLog>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  kind: { type: String, required: true },
  deadline: { type: Date, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } })
EmailLogSchema.index({ userId: 1, kind: 1, deadline: 1 }, { unique: true })
export const EmailLog = mongoose.models.EmailLog || mongoose.model<IEmailLog>('EmailLog', EmailLogSchema)
