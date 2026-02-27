export function SkeletonLine({ className = '' }) {
  return <div className={`skeleton h-4 ${className}`} />
}

export function SkeletonCard() {
  return (
    <div className="bg-soft rounded-r p-4 space-y-3">
      <SkeletonLine className="w-1/3 h-5" />
      <SkeletonLine className="w-2/3" />
      <SkeletonLine className="w-1/2" />
    </div>
  )
}

export function SkeletonList({ count = 5 }) {
  return (
    <div className="space-y-3 px-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <div className="skeleton w-8 h-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonLine className="w-1/3 h-4" />
            <SkeletonLine className="w-2/4 h-3" />
          </div>
          <div className="skeleton w-12 h-5 rounded" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="space-y-2 px-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3">
          {Array.from({ length: cols }).map((_, j) => (
            <SkeletonLine key={j} className="flex-1 h-8" />
          ))}
        </div>
      ))}
    </div>
  )
}
