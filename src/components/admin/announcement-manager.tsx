'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Plus, Megaphone } from 'lucide-react'

interface Announcement {
  id: string
  title: string
  body: string | null
  createdAt: Date
  expiresAt: Date | null
}

export function AnnouncementManager({ announcements: initial }: { announcements: Announcement[] }) {
  const router = useRouter()
  const [announcements, setAnnouncements] = useState(initial)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function add() {
    if (!title.trim()) { setError('Title is required'); return }
    setError('')
    setLoading(true)
    const res = await fetch('/api/admin/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, expiresAt: expiresAt || null }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    setAnnouncements(prev => [data, ...prev])
    setTitle(''); setBody(''); setExpiresAt('')
    router.refresh()
  }

  async function remove(id: string) {
    await fetch(`/api/admin/announcements/${id}`, { method: 'DELETE' })
    setAnnouncements(prev => prev.filter(a => a.id !== id))
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Create form */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
        <h2 className="font-semibold text-zinc-900">New Announcement</h2>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">Title <span className="text-red-500">*</span></label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Complete Day 3 by Friday"
            className="w-full px-3 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">Message (optional)</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={2}
            placeholder="Additional details..."
            className="w-full px-3 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">Expires on (optional)</label>
          <input
            type="date"
            value={expiresAt}
            onChange={e => setExpiresAt(e.target.value)}
            className="w-full px-3 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
          <p className="text-xs text-zinc-400 mt-1">Leave blank to show indefinitely</p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={add}
          disabled={loading}
          className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" /> {loading ? 'Posting…' : 'Post Announcement'}
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-zinc-200">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-900">Active Announcements</h2>
        </div>
        {announcements.length === 0 ? (
          <div className="px-5 py-10 text-center text-zinc-400 text-sm">
            <Megaphone className="h-8 w-8 mx-auto mb-2 text-zinc-200" />
            No announcements yet
          </div>
        ) : (
          <div className="divide-y divide-zinc-50">
            {announcements.map(a => (
              <div key={a.id} className="px-5 py-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{a.title}</p>
                  {a.body && <p className="text-xs text-zinc-500 mt-0.5">{a.body}</p>}
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-zinc-400">
                      Posted {new Date(a.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                    {a.expiresAt && (
                      <span className="text-xs text-amber-600">
                        Expires {new Date(a.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => remove(a.id)} className="text-zinc-300 hover:text-red-500 transition-colors shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
