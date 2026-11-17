'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Plus, Megaphone, Mail, Users, Search } from 'lucide-react'

interface Announcement {
  id: string
  title: string
  body: string | null
  createdAt: Date
  expiresAt: Date | null
  emailedCount?: number | null
  audience?: string[] | null // names; null = everyone
}

interface Employee { id: string; name: string; hasEmail: boolean }

interface EmailResult { sent: number; failed: string[]; noEmail: number }

const inputClass = 'w-full px-3 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-800/30 focus:border-transparent'

export function AnnouncementManager({ announcements: initial, employees }: { announcements: Announcement[]; employees: Employee[] }) {
  const router = useRouter()
  const [announcements, setAnnouncements] = useState(initial)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notify, setNotify] = useState(true)
  const [emailResult, setEmailResult] = useState<EmailResult | null>(null)
  const [onlySelected, setOnlySelected] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  const recipients = onlySelected ? employees.filter(e => selected.has(e.id)) : employees
  const emailable = recipients.filter(e => e.hasEmail).length
  const withoutEmail = recipients.length - emailable
  const canEmail = emailable > 0

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? employees.filter(e => e.name.toLowerCase().includes(q)) : employees
  }, [employees, search])

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function add() {
    if (!title.trim()) { setError('Title is required'); return }
    if (onlySelected && selected.size === 0) { setError('Select at least one employee'); return }
    setError('')
    setEmailResult(null)
    setLoading(true)
    const res = await fetch('/api/admin/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title, body, expiresAt: expiresAt || null,
        sendEmail: notify && canEmail,
        audience: onlySelected ? [...selected] : [],
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    setAnnouncements(prev => [{ ...data, audience: onlySelected ? recipients.map(e => e.name) : null }, ...prev])
    setEmailResult(data.email ?? null)
    setTitle(''); setBody(''); setExpiresAt(''); setSelected(new Set()); setOnlySelected(false); setSearch('')
    router.refresh()
  }

  async function remove(id: string) {
    if (!confirm('Delete this announcement? It disappears from dashboards straight away.')) return
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
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Complete Day 3 by Friday" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">Message (optional)</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={2}
            placeholder="Additional details..."
            className={`${inputClass} resize-none`}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">Expires on (optional)</label>
          <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className={inputClass} />
          <p className="text-xs text-zinc-400 mt-1">Shown until the end of that day. Leave blank to show indefinitely.</p>
        </div>

        {/* Audience */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">Send to</label>
          <div className="flex gap-2">
            {[
              { value: false, label: 'All employees' },
              { value: true, label: 'Only selected employees' },
            ].map(o => (
              <button
                key={o.label}
                type="button"
                onClick={() => setOnlySelected(o.value)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${onlySelected === o.value ? 'border-red-800 bg-red-50 text-red-700' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {onlySelected && (
            <div className="mt-3 border border-zinc-200 rounded-lg">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-100">
                <Search className="h-4 w-4 text-zinc-400 shrink-0" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search employees"
                  className="flex-1 text-sm focus:outline-none bg-transparent"
                />
                <button type="button" onClick={() => setSelected(new Set(visible.map(e => e.id)))} className="text-xs text-red-800 hover:underline shrink-0">Select all</button>
                <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-zinc-500 hover:underline shrink-0">Clear</button>
              </div>
              <div className="max-h-56 overflow-y-auto divide-y divide-zinc-50">
                {visible.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-zinc-400 text-center">No employees match</p>
                ) : visible.map(e => (
                  <label key={e.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-zinc-50">
                    <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} className="h-4 w-4 accent-red-800" />
                    <span className="text-sm text-zinc-800 flex-1">{e.name}</span>
                    {!e.hasEmail && <span className="text-xs text-zinc-400">no email</span>}
                  </label>
                ))}
              </div>
              <p className="px-3 py-2 border-t border-zinc-100 text-xs text-zinc-500">
                {selected.size} selected · only they will see it on their dashboard
              </p>
            </div>
          )}
        </div>

        <label className="flex items-start gap-3 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={notify && canEmail}
            disabled={!canEmail}
            onChange={e => setNotify(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-red-800"
          />
          <span className="text-sm">
            <span className="font-medium text-zinc-800">Also send by email</span>
            <span className="block text-xs text-zinc-500 mt-0.5">
              {recipients.length === 0
                ? 'Select employees to email'
                : !canEmail
                  ? 'None of these employees have an email address'
                  : `Emails ${emailable} employee${emailable === 1 ? '' : 's'}`
                    + (withoutEmail > 0 ? ` · ${withoutEmail} without an email address will only see it on their dashboard` : '')}
            </span>
          </span>
        </label>

        {error && <p className="text-sm text-red-800">{error}</p>}
        {emailResult && (
          <div className={`text-sm px-3 py-2 rounded-lg border ${emailResult.failed.length ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
            Posted and emailed to {emailResult.sent} employee{emailResult.sent === 1 ? '' : 's'}.
            {emailResult.failed.length > 0 && ` Could not email: ${emailResult.failed.join(', ')}.`}
            {emailResult.noEmail > 0 && ` ${emailResult.noEmail} without an email address.`}
          </div>
        )}
        <button
          onClick={add}
          disabled={loading}
          className="inline-flex items-center gap-2 bg-red-800 hover:bg-red-900 disabled:opacity-60 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" /> {loading ? (notify && canEmail ? 'Posting & emailing…' : 'Posting…') : 'Post Announcement'}
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-zinc-200">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-900">Announcements</h2>
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
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">{a.title}</p>
                  {a.body && <p className="text-xs text-zinc-500 mt-0.5 whitespace-pre-line">{a.body}</p>}
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5">
                    <span className="text-xs text-zinc-400">
                      Posted {new Date(a.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                      <Users className="h-3 w-3" />
                      {a.audience?.length ? `To: ${a.audience.join(', ')}` : 'To: all employees'}
                    </span>
                    {!!a.emailedCount && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700">
                        <Mail className="h-3 w-3" /> Emailed to {a.emailedCount}
                      </span>
                    )}
                    {a.expiresAt && (
                      <span className="text-xs text-amber-600">
                        Expires {new Date(a.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => remove(a.id)} aria-label="Delete announcement" className="text-zinc-300 hover:text-red-500 transition-colors shrink-0">
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
