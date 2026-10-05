'use client'
import { useState } from 'react'
import { UserPlus, KeyRound, X, Trash2 } from 'lucide-react'

type Mode = 'add' | 'reset'

interface Props {
  mode: Mode
  employeeId?: string
  employeeName?: string
}

export function EmployeeActions({ mode, employeeId, employeeName }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Add employee state
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', role: 'employee' })
  // Reset password state
  const [newPassword, setNewPassword] = useState('')

  function setField(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  function openModal() { setOpen(true); setError(''); setSuccess('') }
  function closeModal() { setOpen(false); setError(''); setSuccess(''); setNewPassword(''); setForm({ name: '', username: '', email: '', password: '', role: 'employee' }) }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    const res = await fetch('/api/admin/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || 'Failed to add employee'); return }
    closeModal()
    window.location.reload()
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    const res = await fetch(`/api/admin/employees/${employeeId}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || 'Failed'); return }
    setSuccess('Password updated successfully!')
    setNewPassword('')
  }

  return (
    <>
      {mode === 'add' ? (
        <button onClick={openModal} className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <UserPlus className="h-4 w-4" /> Add Employee
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <button onClick={openModal} className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-600 border border-zinc-200 hover:border-red-200 px-2.5 py-1.5 rounded-lg transition-colors">
            <KeyRound className="h-3.5 w-3.5" /> Reset Password
          </button>
          <button
            onClick={async () => {
              if (!confirm(`Delete ${employeeName}? This cannot be undone.`)) return
              await fetch(`/api/admin/employees/${employeeId}`, { method: 'DELETE' })
              window.location.reload()
            }}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-red-600 border border-zinc-200 hover:border-red-200 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-zinc-900">
                {mode === 'add' ? 'Add New Employee' : `Reset Password — ${employeeName}`}
              </h2>
              <button onClick={closeModal} className="text-zinc-400 hover:text-zinc-600 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {mode === 'add' ? (
              <form onSubmit={handleAdd} className="space-y-4">
                {[
                  { label: 'Full Name', key: 'name', type: 'text', placeholder: 'John Smith' },
                  { label: 'Username', key: 'username', type: 'text', placeholder: 'johnsmith' },
                  { label: 'Email (optional)', key: 'email', type: 'text', placeholder: 'john@example.com' },
                  { label: 'Password', key: 'password', type: 'password', placeholder: '••••••••' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">{f.label}</label>
                    <input
                      type={f.type}
                      value={(form as Record<string, string>)[f.key]}
                      onChange={e => setField(f.key, f.key === 'username' ? e.target.value.toLowerCase() : e.target.value)}
                      placeholder={f.placeholder}
                      required={f.key !== 'email'}
                      className="w-full px-3 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">Role</label>
                  <div className="flex gap-3">
                    {['employee', 'admin'].map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setField('role', r)}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-colors capitalize ${form.role === r ? 'border-red-500 bg-red-50 text-red-700' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={closeModal} className="flex-1 border border-zinc-300 text-zinc-700 py-2.5 rounded-lg text-sm hover:bg-zinc-50 transition-colors">Cancel</button>
                  <button type="submit" disabled={loading} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
                    {loading ? 'Adding…' : 'Add Employee'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    required
                    minLength={6}
                    className="w-full px-3 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
                {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
                {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2 rounded-lg">{success}</div>}
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={closeModal} className="flex-1 border border-zinc-300 text-zinc-700 py-2.5 rounded-lg text-sm hover:bg-zinc-50 transition-colors">Close</button>
                  <button type="submit" disabled={loading} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
                    {loading ? 'Saving…' : 'Set Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
