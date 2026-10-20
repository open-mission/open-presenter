interface BrandMarkProps {
  className?: string;
  title?: string;
}

export function BrandMark({ className, title }: BrandMarkProps) {
  return (
    <svg
      viewBox="110 95 280 315"
      className={className}
      fill="none"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <path
        d="M142 150 L292 111 Q309 107 309 126 L309 379 Q309 397 292 393 L142 362 Q126 359 126 343 L126 177 Q126 155 142 150 Z"
        stroke="currentColor"
        strokeWidth="20"
        strokeLinejoin="round"
      />
      <path
        d="M333 145 L366 163 Q375 168 375 181 L375 331 Q375 343 365 348 L333 366 Z"
        fill="currentColor"
      />
      <path
        d="M203 207 Q203 195 215 202 L259 234 Q270 242 259 250 L215 282 Q203 289 203 277 Z"
        fill="currentColor"
      />
    </svg>
  );
}
