'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await signIn('credentials', {
      identifier: identifier.trim(),
      password,
      redirect: false,
    })
    setLoading(false)
    if (res?.error) {
      setError(res.error === 'locked'
        ? 'Too many wrong passwords. This account is locked for 15 minutes.'
        : 'Invalid email or password')
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <main className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image src="/icon.png" alt="Mohidin Properties" width={72} height={72} preload className="mx-auto mb-4" />
          <h1 className="font-brand text-3xl font-extrabold tracking-tight text-red-600">Sales Academy</h1>
          <p className="text-zinc-500 text-sm mt-1">Sign in to continue your training</p>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Email or Username</label>
              <input
                type="text"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="you@example.com or john.smith"
                required
                className="w-full px-3 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3 py-2.5 pr-10 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-zinc-400 mt-6">
            Contact your admin if you need access.
          </p>
        </div>
      </div>
      </main>

      <footer className="py-6 text-center text-xs text-zinc-400">
        <span className="font-brand font-bold text-red-600">Sales Academy</span> by <span className="font-medium text-zinc-500">Mohidin Properties</span>
        <span className="mx-1.5">·</span>© {new Date().getFullYear()}
      </footer>
    </div>
  )
}
