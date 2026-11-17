// Shown instantly while a page loads (via loading.tsx), so every click responds at once
const Bar = ({ className = '' }: { className?: string }) => <div className={`rounded-md bg-zinc-200/70 ${className}`} />

export function PageSkeleton({ variant = 'list' }: { variant?: 'dashboard' | 'day' | 'list' | 'quiz' }) {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      {variant === 'dashboard' && (
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="h-44 rounded-2xl bg-zinc-200/70" />
          {[0, 1, 2].map(i => (
            <div key={i} className="flex gap-5 rounded-2xl border border-zinc-100 bg-white p-4">
              <div className="h-28 w-44 shrink-0 rounded-xl bg-zinc-100" />
              <div className="flex-1 space-y-3 py-1">
                <Bar className="h-5 w-1/2" /><Bar className="h-4 w-3/4" /><Bar className="mt-6 h-1.5 w-full" /><Bar className="h-9 w-28" />
              </div>
            </div>
          ))}
        </div>
      )}

      {variant === 'day' && (
        <div className="space-y-6">
          <Bar className="h-4 w-20" />
          <div className="h-40 rounded-2xl bg-zinc-200/70" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4 rounded-2xl border border-zinc-100 bg-white p-8">
              <Bar className="h-3 w-40" /><Bar className="h-6 w-2/3" />
              <div className="space-y-3 pt-4">{[0, 1, 2, 3, 4].map(i => <Bar key={i} className={`h-4 ${i % 2 ? 'w-5/6' : 'w-full'}`} />)}</div>
            </div>
            <div className="space-y-3 rounded-2xl border border-zinc-100 bg-white p-5">
              <Bar className="h-5 w-32" />{[0, 1, 2, 3, 4, 5].map(i => <Bar key={i} className="h-4 w-full" />)}
            </div>
          </div>
        </div>
      )}

      {variant === 'quiz' && (
        <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-zinc-100 bg-white p-7">
          <Bar className="mx-auto h-12 w-12 rounded-xl" /><Bar className="mx-auto h-6 w-2/3" /><Bar className="mx-auto h-4 w-1/2" />
          <div className="space-y-2 pt-4">{[0, 1, 2, 3].map(i => <Bar key={i} className="h-4 w-full" />)}</div>
          <Bar className="h-11 w-full rounded-xl" />
        </div>
      )}

      {variant === 'list' && (
        <div className="space-y-6">
          <div className="space-y-2"><Bar className="h-7 w-56" /><Bar className="h-4 w-40" /></div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map(i => <div key={i} className="h-32 rounded-xl border border-zinc-100 bg-white" />)}</div>
          <div className="space-y-4 rounded-xl border border-zinc-100 bg-white p-5">
            {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="flex justify-between"><Bar className="h-4 w-1/3" /><Bar className="h-4 w-16" /></div>)}
          </div>
        </div>
      )}
    </div>
  )
}
