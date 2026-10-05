import { requireUser } from '@/lib/auth'
import { ChangePasswordForm } from '@/components/employee/change-password-form'

export default async function SettingsPage() {
  await requireUser()
  return (
    <div className="max-w-md">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Settings</h1>
        <p className="text-zinc-500 text-sm mt-1">Manage your account</p>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <h2 className="font-semibold text-zinc-900 mb-4">Change Password</h2>
        <ChangePasswordForm />
      </div>
    </div>
  )
}
