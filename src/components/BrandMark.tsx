export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="brand-gradient" x1="8" y1="8" x2="40" y2="42">
          <stop stopColor="#72fff0" />
          <stop offset="1" stopColor="#7c8dff" />
        </linearGradient>
      </defs>
      <rect x="2.5" y="2.5" width="43" height="43" rx="14" stroke="url(#brand-gradient)" strokeOpacity=".45" />
      <path
        d="M24 10.5c0 7-5.5 8-5.5 14s5.5 7 5.5 13"
        stroke="url(#brand-gradient)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="24" cy="10.5" r="3.2" fill="#72fff0" />
      <circle cx="18.5" cy="24.5" r="2.6" fill="#72fff0" />
      <circle cx="24" cy="37.5" r="3.2" fill="#7c8dff" />
      <path d="M24 10.5 36 17M24 37.5 12 31" stroke="#7c8dff" strokeOpacity=".6" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
