import { BookmarkIcon, TrashIcon } from "@heroicons/react/24/outline";

import { modeLabel, pendingMessage, relativeTime, senderName, shouldHidePreview } from "../lib/format";
import { href } from "../lib/routes";
import type { Message, Sender, Settings } from "../types";
import { HiddenPreview, ModeIcon } from "./MessageIcons";
import { Badge, IconButton } from "./ui";

const emptyIcon = (
  <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24">
    <path
      d="M5 8.5 12 13l7-4.5M4 7h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  </svg>
);

export function MessageList({
  messages,
  senders,
  settings,
  onDelete,
  onToggleSave
}: {
  messages: Message[];
  senders: Sender[];
  settings: Settings;
  onDelete: (messageId: string) => void;
  onToggleSave: (messageId: string) => void;
}) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center px-4 py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400 dark:bg-neutral-900 dark:text-neutral-500">
          {emptyIcon}
        </span>
        <p className="mt-4 text-sm font-medium text-neutral-950 dark:text-neutral-50">
          Nothing here yet
        </p>
        <p className="mx-auto mt-1.5 max-w-xs text-sm leading-6 text-neutral-500 dark:text-neutral-400">
          When an agent notifies you, it lands here. Open the app to fetch if
          notifications are off.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-neutral-200 dark:divide-neutral-900">
      {messages.map((message) => {
        const sender = senders.find((item) => item.id === message.senderId);
        const hidePreview = shouldHidePreview(
          message,
          sender,
          settings.globalPreviewPolicy
        );

        return (
          <article key={message.id} className="group relative">
            <a
              className="grid min-h-[5.75rem] grid-cols-[2.5rem_minmax(0,1fr)] gap-3 px-4 py-3.5 transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-600 dark:hover:bg-neutral-900/60 dark:focus:ring-blue-400"
              href={href(`/message/${message.id}`)}
            >
              <div className="mt-0.5">
                <ModeIcon message={message} size="sm" />
              </div>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
                    {senderName(sender)}
                  </p>
                  {pendingMessage(message) && <Badge tone="amber">Needs action</Badge>}
                </div>
                <h3 className="mt-0.5 truncate text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {message.title}
                </h3>
                <p className="mt-1 line-clamp-2 text-sm leading-5 text-neutral-600 dark:text-neutral-300">
                  {hidePreview ? <HiddenPreview /> : message.body}
                </p>
                <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
                  {modeLabel(message.mode)} &middot; {relativeTime(message.createdAt)}
                </p>
              </div>
            </a>
            <div className="absolute right-3 top-3 hidden gap-1 rounded-lg bg-white/95 shadow-sm ring-1 ring-neutral-200 group-hover:flex group-focus-within:flex dark:bg-neutral-950/95 dark:ring-neutral-800">
              <IconButton
                label={message.saved ? "Unsave message" : "Save message"}
                onClick={() => onToggleSave(message.id)}
              >
                <BookmarkIcon className={message.saved ? "h-5 w-5 fill-current" : "h-5 w-5"} />
              </IconButton>
              <IconButton label="Delete message" onClick={() => onDelete(message.id)}>
                <TrashIcon className="h-5 w-5" />
              </IconButton>
            </div>
          </article>
        );
      })}
    </div>
  );
}
