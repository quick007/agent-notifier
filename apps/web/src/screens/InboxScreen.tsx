import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";

import { pendingMessage } from "../lib/format";
import type { AppState, Message } from "../types";
import { MessageList } from "../components/MessageList";
import { Badge, Button, cn } from "../components/ui";

type Filter = "all" | "needs_action";

export function InboxScreen({
  state,
  savedOnly = false,
  onDelete,
  onToggleSave
}: {
  state: AppState;
  savedOnly?: boolean;
  onDelete: (messageId: string) => void;
  onToggleSave: (messageId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const messages = useMemo(() => {
    return state.messages
      .filter((message) => visibleMessage(message, savedOnly, filter, query))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [filter, query, savedOnly, state.messages]);

  return (
    <section className="an-rise mx-auto w-full max-w-3xl py-4 md:py-8">
      <header className="px-4 md:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">
              {savedOnly ? "Saved" : "Inbox"}
            </h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {savedOnly
                ? "Kept beyond local auto-expiry."
                : "Decrypted on this device. Newest first."}
            </p>
          </div>
          {!savedOnly && state.settings.pushState === "paired_no_push" && (
            <Badge tone="amber">Push off</Badge>
          )}
        </div>

        {!savedOnly && state.settings.pushState === "paired_no_push" && (
          <a
            className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900 transition hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100 dark:hover:bg-amber-900/60"
            href="#/settings/notifications"
          >
            <span>Notifications are off. Messages arrive when you open the app.</span>
            <span className="shrink-0 font-medium underline-offset-2 group-hover:underline">Turn on</span>
          </a>
        )}

        <div className="mt-5 flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 transition focus-within:ring-2 focus-within:ring-blue-600 dark:border-neutral-800 dark:bg-neutral-900 dark:focus-within:ring-blue-400">
          <MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-neutral-400" />
          <input
            className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search local messages"
            value={query}
          />
        </div>

        {!savedOnly && (
          <div className="mt-3 flex gap-2">
            <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
              All
            </FilterButton>
            <FilterButton
              active={filter === "needs_action"}
              onClick={() => setFilter("needs_action")}
            >
              Needs action
            </FilterButton>
          </div>
        )}
      </header>

      <div className="mt-4 border-y border-neutral-200 bg-white dark:border-neutral-900 dark:bg-neutral-950 md:mx-8 md:rounded-2xl md:border">
        <MessageList
          messages={messages}
          onDelete={onDelete}
          onToggleSave={onToggleSave}
          senders={state.senders}
          settings={state.settings}
        />
      </div>
    </section>
  );
}

function FilterButton({
  active,
  children,
  onClick
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <Button
      className={cn(active && "border-neutral-950 dark:border-neutral-50")}
      onClick={onClick}
      tone={active ? "neutral" : "ghost"}
    >
      {children}
    </Button>
  );
}

function visibleMessage(
  message: Message,
  savedOnly: boolean,
  filter: Filter,
  query: string
) {
  if (message.deleted) return false;
  if (savedOnly && !message.saved) return false;
  if (filter === "needs_action" && !pendingMessage(message)) return false;

  const haystack = `${message.title} ${message.body}`.toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}
