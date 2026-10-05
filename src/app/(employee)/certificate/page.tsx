import { requireUser } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { Certificate } from '@/models/Certificate'
import { redirect } from 'next/navigation'
import { Award } from 'lucide-react'

export default async function CertificatePage() {
  const user = await requireUser()
  await connectDB()
  const cert = await Certificate.findOne({ userId: user.id }).lean()
  if (!cert) redirect('/dashboard')

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-white rounded-2xl border-2 border-red-200 p-10 max-w-md w-full text-center shadow-sm">
        <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Award className="h-8 w-8 text-white" />
        </div>
        <p className="text-xs font-semibold text-red-600 uppercase tracking-widest mb-2">Certificate of Completion</p>
        <h1 className="text-2xl font-bold text-zinc-900 mb-1">Sales Academy</h1>
        <p className="text-zinc-500 text-sm mb-6">This certifies that</p>
        <p className="text-3xl font-bold text-zinc-900 mb-6">{user.name}</p>
        <p className="text-zinc-500 text-sm">has successfully completed the 15-day Sales Academy training programme.</p>
        <div className="h-px bg-zinc-100 my-6" />
        <p className="text-xs text-zinc-400">Completed on {new Date(cert.completionDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
    </div>
  )
}
