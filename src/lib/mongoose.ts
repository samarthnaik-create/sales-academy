import mongoose from 'mongoose'

const MONGODB_URI = process.env.DATABASE_URL!

const cached = (globalThis as any).__mongoose ?? { conn: null, promise: null }
;(globalThis as any).__mongoose = cached

export async function connectDB() {
  if (cached.conn) return cached.conn
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      bufferCommands: false,
    }).then(m => m)
  }
  cached.conn = await cached.promise
  return cached.conn
}
