function PlaceholderPage({ title, description, icon: Icon, comingLabel }) {
  return (
    <div className="px-8 py-6">
      <div className="card">
        <div className="empty-state">
          <div className="w-16 h-16 rounded-2xl bg-app-surface-2 border border-app-border flex items-center justify-center mb-4">
            <Icon size={28} className="text-app-muted-2" />
          </div>
          <h3 className="text-sm font-semibold text-app-text mb-1">{title}</h3>
          <p className="text-xs text-app-muted-2 mb-5 max-w-sm">{description}</p>
          <span className="px-3 py-1.5 rounded-full bg-brand-600/10 border border-brand-600/30 text-[11px] font-semibold text-brand-400">
            {comingLabel}
          </span>
        </div>
      </div>
    </div>
  )
}

export default PlaceholderPage