import { NextAuthOptions, getServerSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { connectDB } from './mongoose'
import { User } from '@/models/User'

const MAX_FAILED_LOGINS = 5
const LOCK_MINUTES = 15
export const LOCKED_ERROR = 'locked'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        identifier: { label: 'Email or Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const identifier = credentials?.identifier
        const password = credentials?.password
        if (typeof identifier !== 'string' || typeof password !== 'string' || !identifier || !password) return null

        await connectDB()
        const id = identifier.trim().toLowerCase()
        const user = await User.findOne(id.includes('@') ? { email: id } : { username: id }).lean()
        if (!user) return null

        // Too many wrong passwords: lock the account for a while (stops password guessing)
        if (user.lockUntil && user.lockUntil > new Date()) throw new Error(LOCKED_ERROR)

        const valid = await bcrypt.compare(password, user.password)
        if (!valid) {
          const failed = (user.failedLogins ?? 0) + 1
          await User.updateOne({ _id: user._id }, failed >= MAX_FAILED_LOGINS
            ? { $set: { failedLogins: 0, lockUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000) } }
            : { $set: { failedLogins: failed } })
          return null
        }
        if (user.failedLogins || user.lockUntil) {
          await User.updateOne({ _id: user._id }, { $set: { failedLogins: 0 }, $unset: { lockUntil: 1 } })
        }

        return { id: String(user._id), name: user.name, email: user.email, role: user.role }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as unknown as { role: string }).role
        return token
      }
      // Re-check the account on every use, so deleting an employee or changing a role takes effect at once
      try {
        await connectDB()
        const current = await User.findById(token.sub, { role: 1, name: 1 }).lean()
        if (!current) token.revoked = true
        else { token.role = current.role; token.name = current.name }
      } catch {
        // Database briefly unreachable: keep the session rather than logging everyone out
      }
      return token
    },
    async session({ session, token }) {
      if (token.revoked) return { expires: session.expires } as typeof session
      if (session.user) {
        session.user.id = token.sub!
        session.user.role = token.role as string
        session.user.name = token.name
      }
      return session
    },
  },
}

// Null when signed out or when the account was deleted
export async function getSession() {
  const session = await getServerSession(authOptions)
  return session?.user?.id ? session : null
}

export async function requireUser() {
  const session = await getSession()
  if (!session?.user) throw new Error('Unauthorized')
  return session.user
}

export async function requireAdmin() {
  const user = await requireUser()
  if (user.role !== 'admin') throw new Error('Forbidden')
  return user
}
