import { BookmarkIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useState } from "react";

import { modeLabel, relativeTime, senderName } from "../lib/format";
import type { Message, Sender } from "../types";
import { ModeIcon, StateBadge } from "./MessageIcons";
import { Badge, Button, ConfirmDialog } from "./ui";

export function MessageDetail({
  message,
  sender,
  onDelete,
  onToggleSave,
  onReply,
  onApproval
}: {
  message: Message;
  sender: Sender | undefined;
  onDelete: () => void;
  onToggleSave: () => void;
  onReply: (text: string) => void;
  onApproval: (decision: "approved" | "rejected", text?: string) => void;
}) {
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const pending = !message.response && message.deliveryState !== "expired";

  return (
    <section className="an-rise mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-5 md:px-8 md:py-8">
      <a className="mb-4 inline-flex text-sm text-neutral-500 hover:text-neutral-950 dark:hover:text-neutral-50 md:hidden" href="#/inbox">
        Back to inbox
      </a>
      <div className="flex items-start gap-3">
        <ModeIcon message={message} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{modeLabel(message.mode)}</Badge>
            <StateBadge state={message.deliveryState} />
            {message.sensitive && <Badge tone="amber">Sensitive</Badge>}
          </div>
          <h1 className="mt-3 break-words text-xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
            {message.title}
          </h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            {senderName(sender)} &middot; {relativeTime(message.createdAt)}
          </p>
        </div>
      </div>

      <p className="mt-6 whitespace-pre-wrap break-words text-[15px] leading-7 text-neutral-800 dark:text-neutral-200">
        {message.body}
      </p>

      {message.mode === "request_reply" && pending && (
        <form
          className="mt-7"
          onSubmit={(event) => {
            event.preventDefault();
            if (reply.trim()) onReply(reply.trim());
          }}
        >
          <label className="text-sm font-medium" htmlFor="reply">
            Reply
          </label>
          <textarea
            className="mt-2 min-h-28 w-full resize-y rounded-xl border border-neutral-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-blue-600 dark:border-neutral-800 dark:bg-neutral-900 dark:focus:ring-blue-400"
            id="reply"
            maxLength={500}
            onChange={(event) => setReply(event.target.value)}
            placeholder={message.request?.prompt ?? "Send a short answer"}
            value={reply}
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs text-neutral-500">{reply.length}/500</span>
            <Button tone="primary" type="submit">Send reply</Button>
          </div>
        </form>
      )}

      {message.mode === "request_approval" && pending && (
        <div className="mt-7 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-sm font-medium">
            {message.request?.actionLabel ?? "Approve action"}
          </p>
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
            {message.request?.riskText ??
              "Agent Notifier returns signed human intent. It does not run the action."}
          </p>
          <textarea
            className="mt-4 min-h-20 w-full resize-y rounded-lg border border-neutral-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-blue-600 dark:border-neutral-800 dark:bg-neutral-950 dark:focus:ring-blue-400"
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional note"
            value={note}
          />
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button onClick={() => onApproval("rejected", note.trim() || undefined)}>
              Reject
            </Button>
            <Button tone="primary" onClick={() => onApproval("approved", note.trim() || undefined)}>
              Approve
            </Button>
          </div>
        </div>
      )}

      {message.response && (
        <div className="mt-7 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
          {message.response.decision === "rejected"
            ? "Rejected"
            : message.response.decision === "approved"
              ? "Approved"
              : "Reply sent"}{" "}
          {relativeTime(message.response.respondedAt)}.
        </div>
      )}

      {message.deliveryState === "expired" && !message.response && (
        <div className="mt-7 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
          This request expired before a response. Kept locally for context.
        </div>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-8">
        <Button onClick={onToggleSave}>
          <BookmarkIcon className="h-5 w-5" />
          {message.saved ? "Unsave" : "Save"}
        </Button>
        <ConfirmDialog
          body="Delete removes this decrypted message from local history on this device."
          confirmLabel="Delete"
          onConfirm={onDelete}
          title="Delete message?"
        >
          <Button tone="danger">
            <TrashIcon className="h-5 w-5" />
            Delete
          </Button>
        </ConfirmDialog>
      </div>
    </section>
  );
}
