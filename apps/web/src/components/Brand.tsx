export function BrandMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 2.75 4.5 5.5v5.6c0 4.4 3 7.6 7.5 9.15 4.5-1.55 7.5-4.75 7.5-9.15V5.5L12 2.75Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="M9 12.4a3 3 0 0 1 6 0c0 1.35.4 2 .9 2.5H8.1c.5-.5.9-1.15.9-2.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
      <path
        d="M11 16.2h2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

export function Wordmark() {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-950 text-white shadow-sm dark:bg-white dark:text-neutral-950">
        <BrandMark className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
          Agent Notifier
        </p>
        <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
          Encrypted &middot; on this device
        </p>
      </div>
    </div>
  );
}
