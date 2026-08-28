export default function BrandMark({ size = 36, className = '' }) {
  return (
    <svg data-no-translate width={size} height={size} viewBox="0 0 64 64" aria-label="YNlogin" className={className}>
      <defs>
        <linearGradient id="yn-brand-bg" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" /><stop offset=".52" stopColor="#4F46E5" /><stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
        <linearGradient id="yn-brand-accent" x1="19" y1="19" x2="45" y2="45" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" /><stop offset="1" stopColor="#A5F3FC" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="17" fill="url(#yn-brand-bg)" />
      <path d="M19 19l13 13 13-13M32 32v14" fill="none" stroke="url(#yn-brand-accent)" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="19" cy="19" r="4" fill="#fff" /><circle cx="45" cy="19" r="4" fill="#C4B5FD" /><circle cx="32" cy="46" r="4" fill="#67E8F9" />
      <path d="M18 46V33l13 13" fill="none" stroke="#fff" strokeOpacity=".92" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
