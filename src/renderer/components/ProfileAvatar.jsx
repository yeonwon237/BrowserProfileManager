import { getAvatarPalette, getInitials } from '../lib/avatar'

function ProfileAvatar({ seed, name, size = 36, status, className = '' }) {
  const { from, to } = getAvatarPalette(seed)
  const radius = Math.round(size * 0.28)
  
  return (
    <div className={`relative shrink-0 ${className}`}>
      <div
        className="flex items-center justify-center text-white font-bold tracking-tight border border-white/20 select-none transition-transform duration-200 hover:scale-105"
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          background: `linear-gradient(135deg, ${from}, ${to})`,
          fontSize: Math.max(10, Math.round(size * 0.36)),
          boxShadow: `0 3px 12px ${from}40`,
        }}
      >
        {getInitials(name)}
      </div>
      {status === 'running' && (
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-app-surface ring-2 ring-emerald-500/30 animate-pulse" />
      )}
      {status === 'warning' && (
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-500 border-2 border-white dark:border-app-surface ring-2 ring-amber-500/30" />
      )}
      {status === 'queued' && (
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-sky-500 border-2 border-white dark:border-app-surface ring-2 ring-sky-500/30 animate-pulse" />
      )}
    </div>
  )
}

export default ProfileAvatar