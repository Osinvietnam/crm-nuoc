// Shared UI primitives — spinner, empty state

export function Spinner({ className = '' }: { className?: string }) {
  return <span className={`crm-spinner ${className}`} />
}

export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Spinner />
    </div>
  )
}

export function SectionLoader({ text = 'Đang tải...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-sm">
      <Spinner />
      <span>{text}</span>
    </div>
  )
}

export function EmptyState({
  icon = '📭',
  title,
  subtitle,
}: {
  icon?: string
  title: string
  subtitle?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
      <span className="text-4xl">{icon}</span>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
    </div>
  )
}
