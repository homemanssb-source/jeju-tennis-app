export default function PageHeader({ title, subtitle, right }) {
  return (
    <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-30 border-b border-line">
      <div className="flex items-center justify-between px-5 py-3 max-w-lg mx-auto">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-xs text-sub mt-0.5">{subtitle}</p>}
        </div>
        {right && <div>{right}</div>}
      </div>
    </div>
  )
}
