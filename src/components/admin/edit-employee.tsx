'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, X } from 'lucide-react'

interface Props {
  employee: { id: string; name: string; username: string; email: string }
}

const inputClass = 'w-full px-3 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent'

// Placeholder given to employees added without an email; show it as empty
const realEmail = (email: string) => (email.endsWith('@noemail.local') ? '' : email)

export function EditEmployee({ employee }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', username: '', email: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function openModal() {
    setForm({ name: employee.name, username: employee.username, email: realEmail(employee.email) })
    setError('')
    setOpen(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    const res = await fetch(`/api/admin/employees/${employee.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || 'Could not save changes'); return }
    setOpen(false)
    router.refresh()
  }

  const loginChanged = form.username.trim().toLowerCase() !== employee.username
    || (form.email.trim().toLowerCase() || '') !== realEmail(employee.email)

  return (
    <>
      <button
        onClick={openModal}
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-600 border border-zinc-200 hover:border-red-200 px-2.5 py-1.5 rounded-lg transition-colors"
      >
        <Pencil className="h-3.5 w-3.5" /> Edit
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-zinc-900">Edit Employee</h2>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-zinc-400 hover:text-zinc-600 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={save} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Full Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Username</label>
                <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase() }))} required className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Email (optional)</label>
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="john@example.com" className={inputClass} />
                <p className="text-xs text-zinc-400 mt-1">Used for login and for reminder and announcement emails</p>
              </div>
              {loginChanged && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-lg">
                  The login details are changing. Let {employee.name.split(' ')[0]} know the new username or email to sign in with. The password stays the same.
                </div>
              )}
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 border border-zinc-300 text-zinc-700 py-2.5 rounded-lg text-sm hover:bg-zinc-50 transition-colors">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
                  {loading ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
