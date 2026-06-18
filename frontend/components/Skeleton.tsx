"use client";

function Bone({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-slate-200 ${className}`}
      style={style}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="card space-y-3">
      <Bone className="h-3 w-24" />
      <Bone className="h-8 w-32" />
      <Bone className="h-3 w-16" />
    </div>
  );
}

export function SkeletonKPIRow({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonTableRow({ cols = 6 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Bone className={`h-4 ${i === 0 ? "w-32" : "w-20"}`} />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonTable({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-border">
        <Bone className="h-5 w-48" />
      </div>
      <table className="w-full">
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonTableRow key={i} cols={cols} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="card space-y-4">
      <Bone className="h-5 w-40" />
      <div className="flex items-end gap-2 h-48">
        {[40, 65, 50, 80, 45, 70, 55].map((h, i) => (
          <Bone key={i} className="flex-1" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonCalendar() {
  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <Bone className="h-6 w-48" />
        <div className="flex gap-2">
          <Bone className="h-8 w-8 rounded" />
          <Bone className="h-8 w-8 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <Bone key={`h-${i}`} className="h-4 w-full" />
        ))}
        {Array.from({ length: 21 }).map((_, i) => (
          <Bone key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card flex items-center gap-4">
          <Bone className="w-10 h-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Bone className="h-4 w-40" />
            <Bone className="h-3 w-64" />
          </div>
          <Bone className="h-8 w-20 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Bone className="h-7 w-48" />
          <Bone className="h-4 w-32" />
        </div>
        <Bone className="h-10 w-36 rounded-lg" />
      </div>
      <SkeletonKPIRow />
      <SkeletonTable />
    </div>
  );
}
