import { NextAuthOptions, getServerSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { connectDB } from './mongoose'
import { User } from '@/models/User'

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
        if (!credentials?.identifier || !credentials?.password) return null

        await connectDB()
        const isEmail = credentials.identifier.includes('@')
        const user = await User.findOne(
          isEmail
            ? { email: credentials.identifier.toLowerCase() }
            : { username: credentials.identifier.toLowerCase() }
        ).lean()

        if (!user) return null
        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) return null

        return { id: String(user._id), name: user.name, email: user.email, role: user.role }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = (user as unknown as { role: string }).role
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!
        session.user.role = token.role as string
      }
      return session
    },
  },
}

export const getSession = () => getServerSession(authOptions)

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
