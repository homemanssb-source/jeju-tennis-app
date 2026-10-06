export default function PageHeader({ title, subtitle, right, children }) {
  return (
    <div className="sticky top-0 bg-white z-30 border-b border-line">
      <div className="flex items-center justify-between gap-3 px-5 py-3 max-w-lg mx-auto">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">{title}</h1>
          {subtitle && <p className="text-xs text-sub mt-0.5 truncate">{subtitle}</p>}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      {/* 스크롤해도 항상 보여야 하는 영역(검색창 등) */}
      {children && <div className="px-5 pb-3 max-w-lg mx-auto">{children}</div>}
    </div>
  )
}
