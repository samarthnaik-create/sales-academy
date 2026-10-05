'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!/^[a-z0-9_]+$/.test(form.username)) {
      setError('Username can only contain lowercase letters, numbers, and underscores')
      return
    }
    setLoading(true)
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || 'Registration failed'); return }
    router.push('/login?registered=1')
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-red-600 rounded-xl mb-4">
            <span className="text-white font-bold text-lg">SA</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">Sales Academy</h1>
          <p className="text-zinc-500 text-sm mt-1">Create your account</p>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Full Name</label>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="John Smith" required className="w-full px-3 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Username</label>
              <input type="text" value={form.username} onChange={e => set('username', e.target.value.toLowerCase())} placeholder="johnsmith" required className="w-full px-3 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com" required className="w-full px-3 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Password</label>
              <input type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" required minLength={6} className="w-full px-3 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent" />
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}

            <button type="submit" disabled={loading} className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-zinc-500 mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-red-600 font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
