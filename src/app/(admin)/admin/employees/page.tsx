export const dynamic = 'force-dynamic'

import { requireAdmin } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { User } from '@/models/User'
import { Course } from '@/models/Course'
import { Progress } from '@/models/Progress'
import { Certificate } from '@/models/Certificate'
import { EmployeeActions } from '@/components/admin/employee-actions'
import { CheckCircle2, Award } from 'lucide-react'

export default async function EmployeesPage() {
  await requireAdmin()

  await connectDB()

  const [employeeDocs, totalCourses] = await Promise.all([
    User.find({ role: 'employee' }).sort({ createdAt: -1 }).lean(),
    Course.countDocuments(),
  ])

  const empIds = employeeDocs.map(e => e._id)
  const [allProgress, allCerts] = await Promise.all([
    Progress.find({ userId: { $in: empIds } }).lean(),
    Certificate.find({ userId: { $in: empIds } }).lean(),
  ])

  const progressByEmp: Record<string, typeof allProgress> = {}
  for (const p of allProgress) {
    const uid = String(p.userId)
    if (!progressByEmp[uid]) progressByEmp[uid] = []
    progressByEmp[uid].push(p)
  }

  const certByEmp = Object.fromEntries(allCerts.map(c => [String(c.userId), c]))

  const employees = employeeDocs.map(emp => ({
    id: String(emp._id),
    name: emp.name,
    email: emp.email,
    username: emp.username,
    progress: progressByEmp[String(emp._id)] || [],
    certificate: certByEmp[String(emp._id)] ?? null,
  }))

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Employees</h1>
          <p className="text-zinc-500 text-sm mt-1">{employees.length} registered employees</p>
        </div>
        <EmployeeActions mode="add" />
      </div>

      {employees.length === 0 ? (
        <div className="bg-white rounded-xl border border-zinc-200 py-16 text-center">
          <p className="font-medium text-zinc-500">No employees yet</p>
          <p className="text-sm mt-1 text-zinc-400">Click &quot;Add Employee&quot; above to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="text-left px-5 py-3 font-medium text-zinc-500">Employee</th>
                  <th className="text-left px-5 py-3 font-medium text-zinc-500">Username</th>
                  <th className="text-left px-5 py-3 font-medium text-zinc-500">Progress</th>
                  <th className="text-left px-5 py-3 font-medium text-zinc-500">Status</th>
                  <th className="text-left px-5 py-3 font-medium text-zinc-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {employees.map(emp => {
                  const completed = emp.progress.filter(p => p.completed).length
                  const pct = totalCourses > 0 ? Math.round((completed / totalCourses) * 100) : 0
                  return (
                    <tr key={emp.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                            <span className="text-red-700 text-xs font-bold">{emp.name.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="font-medium text-zinc-900">{emp.name}</p>
                            <p className="text-xs text-zinc-400">{emp.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-zinc-500">@{emp.username}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 bg-zinc-100 rounded-full overflow-hidden">
                            <div className="h-full bg-red-600 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-zinc-500">{completed}/{totalCourses}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {emp.certificate ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                            <Award className="h-3 w-3" /> Certified
                          </span>
                        ) : pct === 100 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
                            <CheckCircle2 className="h-3 w-3" /> Complete
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400">{pct}% done</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <EmployeeActions mode="reset" employeeId={emp.id} employeeName={emp.name} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
