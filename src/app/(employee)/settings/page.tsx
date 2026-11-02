import { requireUser } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function SettingsPage() {
  await requireUser()
  redirect('/dashboard')
}
