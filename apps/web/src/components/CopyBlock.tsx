import { CheckIcon, ClipboardDocumentIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";

import { cn } from "./ui";

export function CopyBlock({
  value,
  label,
  multiline = false,
  className
}: {
  value: string;
  label?: string;
  multiline?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className={cn(
        "relative rounded-xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60",
        className
      )}
    >
      {label && (
        <p className="border-b border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          {label}
        </p>
      )}
      <pre
        className={cn(
          "overflow-x-auto px-3 py-3 pr-12 font-mono text-[13px] leading-6 text-neutral-800 dark:text-neutral-200",
          multiline ? "whitespace-pre-wrap break-words" : "whitespace-pre"
        )}
      >
        {value}
      </pre>
      <button
        aria-label={copied ? "Copied" : "Copy"}
        className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-500 transition hover:text-neutral-950 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-400 dark:hover:text-neutral-50 dark:focus:ring-blue-400"
        onClick={copy}
        title={copied ? "Copied" : "Copy"}
        type="button"
      >
        {copied ? (
          <CheckIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
        ) : (
          <ClipboardDocumentIcon className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
