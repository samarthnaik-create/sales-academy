'use client'
import { useState } from 'react'
import { UserPlus, X } from 'lucide-react'

export function AddEmployeeForm() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await fetch('/api/admin/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || 'Failed'); return }
    setOpen(false)
    setForm({ name: '', email: '', password: '' })
    window.location.reload()
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
        <UserPlus className="h-4 w-4" /> Add Employee
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-zinc-900">Add Employee</h2>
              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {[
                { label: 'Full Name', key: 'name', type: 'text', placeholder: 'John Smith' },
                { label: 'Email or Username', key: 'email', type: 'text', placeholder: 'john@example.com or john.smith' },
                { label: 'Password', key: 'password', type: 'password', placeholder: '••••••••' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">{f.label}</label>
                  <input type={f.type} value={(form as Record<string, string>)[f.key]} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} required className="w-full px-3 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent" />
                </div>
              ))}
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 border border-zinc-300 text-zinc-700 py-2.5 rounded-lg text-sm hover:bg-zinc-50 transition-colors">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
                  {loading ? 'Adding…' : 'Add Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
