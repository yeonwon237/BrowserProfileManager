function hashCode(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

const PALETTES = [
  { from: '#7c4dff', to: '#4a1aab' },
  { from: '#06b6d4', to: '#0e7490' },
  { from: '#10b981', to: '#065f46' },
  { from: '#f59e0b', to: '#92400e' },
  { from: '#ef4444', to: '#7f1d1d' },
  { from: '#ec4899', to: '#831843' },
  { from: '#8b5cf6', to: '#5b21b6' },
  { from: '#14b8a6', to: '#134e4a' },
  { from: '#f97316', to: '#7c2d12' },
  { from: '#6366f1', to: '#312e81' },
  { from: '#22c55e', to: '#14532d' },
  { from: '#a855f7', to: '#581c87' },
]

export function getAvatarPalette(seed) {
  const hash = hashCode(String(seed))
  return PALETTES[hash % PALETTES.length]
}

export function getInitials(name) {
  const clean = (name || '?').trim()
  if (!clean) return '?'
  const parts = clean.split(/\s+/)
  if (parts.length === 1) return clean.slice(0, 1).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}