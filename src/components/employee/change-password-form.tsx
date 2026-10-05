'use client'
import { useState } from 'react'
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react'

export function ChangePasswordForm() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess(false)
    setLoading(true)
    const res = await fetch('/api/user/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    setSuccess(true)
    setCurrent(''); setNext('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Current Password</label>
        <div className="relative">
          <input
            type={showCurrent ? 'text' : 'password'}
            value={current}
            onChange={e => setCurrent(e.target.value)}
            required
            placeholder="••••••••"
            className="w-full px-3 py-2.5 pr-10 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <button type="button" onClick={() => setShowCurrent(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
            {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1.5">New Password</label>
        <div className="relative">
          <input
            type={showNext ? 'text' : 'password'}
            value={next}
            onChange={e => setNext(e.target.value)}
            required
            minLength={6}
            placeholder="Min. 6 characters"
            className="w-full px-3 py-2.5 pr-10 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <button type="button" onClick={() => setShowNext(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
            {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>}
      {success && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-100 px-3 py-2 rounded-lg">
          <CheckCircle2 className="h-4 w-4" /> Password changed successfully
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
      >
        {loading ? 'Updating…' : 'Update Password'}
      </button>
    </form>
  )
}
