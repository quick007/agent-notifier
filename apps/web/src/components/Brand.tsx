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

export function GitHubIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.09.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.3 9.3 0 0 1 2.5-.34c.85 0 1.71.12 2.5.34 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.57 5.05.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.59.69.49A10.02 10.02 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z"
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
