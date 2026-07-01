import {
  BellIcon,
  ChatBubbleLeftEllipsisIcon,
  CheckCircleIcon,
  ClockIcon,
  HandThumbUpIcon,
  LockClosedIcon
} from "@heroicons/react/24/outline";

import type { DeliveryState, Message } from "../types";
import { Badge, cn } from "./ui";

type Tone = "neutral" | "blue" | "green" | "amber" | "violet";

const toneChip: Record<Tone, string> = {
  neutral: "bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300",
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300",
  green: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-300",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-300"
};

function iconFor(message: Message) {
  if (message.deliveryState === "expired") {
    return { Icon: ClockIcon, label: "Expired", tone: "neutral" as Tone };
  }
  if (message.mode === "request_reply") {
    return { Icon: ChatBubbleLeftEllipsisIcon, label: "Reply request", tone: "blue" as Tone };
  }
  if (message.mode === "request_approval") {
    return { Icon: HandThumbUpIcon, label: "Approval request", tone: "violet" as Tone };
  }
  return { Icon: BellIcon, label: "Notification", tone: "neutral" as Tone };
}

export function ModeIcon({
  message,
  size = "md"
}: {
  message: Message;
  size?: "sm" | "md";
}) {
  const { Icon, label, tone } = iconFor(message);
  const box = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const glyph = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <span
      aria-label={label}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl",
        box,
        toneChip[tone]
      )}
      role="img"
    >
      <Icon className={glyph} />
    </span>
  );
}

export function StateBadge({ state }: { state: DeliveryState }) {
  if (state === "responded") {
    return (
      <Badge tone="green">
        <CheckCircleIcon className="h-3.5 w-3.5" />
        Responded
      </Badge>
    );
  }
  if (state === "expired") {
    return (
      <Badge tone="neutral">
        <ClockIcon className="h-3.5 w-3.5" />
        Expired
      </Badge>
    );
  }
  return <Badge tone="blue">Delivered</Badge>;
}

export function HiddenPreview() {
  return (
    <span className="inline-flex min-w-0 items-center gap-1 text-neutral-500 dark:text-neutral-400">
      <LockClosedIcon className="h-4 w-4 shrink-0" />
      <span className="truncate">Hidden preview</span>
    </span>
  );
}
