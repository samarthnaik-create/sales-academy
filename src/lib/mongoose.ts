import mongoose from 'mongoose'

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }
const g = globalThis as typeof globalThis & { __mongoose?: Cache }
const cached: Cache = g.__mongoose ?? { conn: null, promise: null }
g.__mongoose = cached

export async function connectDB() {
  if (cached.conn) return cached.conn
  if (!cached.promise) {
    const uri = process.env.DATABASE_URL
    if (!uri) throw new Error('DATABASE_URL is not set')
    cached.promise = mongoose.connect(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      bufferCommands: false,
    }).then(m => m)
  }
  try {
    cached.conn = await cached.promise
  } catch (err) {
    cached.promise = null // let the next request try again
    throw err
  }
  return cached.conn
}
