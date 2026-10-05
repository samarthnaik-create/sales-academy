import mongoose, { Schema, Document } from 'mongoose'
export interface ICertificate extends Document {
  userId: mongoose.Types.ObjectId; completionDate: string; createdAt: Date
}
const CertificateSchema = new Schema<ICertificate>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  completionDate: { type: String, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } })
export const Certificate = mongoose.models.Certificate || mongoose.model<ICertificate>('Certificate', CertificateSchema)
