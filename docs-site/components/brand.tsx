import Link from 'next/link';

export function BrandMark({ className = 'size-7' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      role="img"
      aria-label="Open Presenter"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="38" y="38" width="436" height="436" rx="84" className="brand-tile" />
      <path
        d="M142 150 L292 111 Q309 107 309 126 L309 379 Q309 397 292 393 L142 362 Q126 359 126 343 L126 177 Q126 155 142 150 Z"
        fill="none"
        className="brand-stroke"
        strokeWidth="20"
        strokeLinejoin="round"
      />
      <path
        d="M333 145 L366 163 Q375 168 375 181 L375 331 Q375 343 365 348 L333 366 Z"
        className="brand-ink"
      />
      <path
        d="M203 207 Q203 195 215 202 L259 234 Q270 242 259 250 L215 282 Q203 289 203 277 Z"
        className="brand-ink"
      />
    </svg>
  );
}

export function Brand({ suffix = 'docs' }: { suffix?: string | null }) {
  return (
    <span className="brand">
      <BrandMark className="brand-mark" />
      <span className="brand-name">Open Presenter</span>
      {suffix && <span className="brand-suffix">{suffix}</span>}
    </span>
  );
}

export function BrandLink({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="brand-link" aria-label="Open Presenter — início">
      <Brand />
    </Link>
  );
}
