import { Dialog } from "@base-ui-components/react/dialog";
import { Switch } from "@base-ui-components/react/switch";
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from "react";
import { cloneElement, useState } from "react";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Button({
  children,
  className,
  tone = "neutral",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "neutral" | "primary" | "danger" | "ghost";
}) {
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 dark:focus:ring-blue-400 dark:focus:ring-offset-neutral-950",
        tone === "primary" &&
          "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400",
        tone === "neutral" &&
          "border border-neutral-200 bg-white text-neutral-950 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-50 dark:hover:bg-neutral-800",
        tone === "danger" &&
          "bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400",
        tone === "ghost" &&
          "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-900",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-50 dark:focus:ring-blue-400 dark:focus:ring-offset-neutral-950",
        className
      )}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: "neutral" | "blue" | "green" | "amber" | "red";
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        tone === "neutral" && "bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300",
        tone === "blue" && "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
        tone === "green" && "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
        tone === "amber" && "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-200",
        tone === "red" && "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      )}
    >
      {children}
    </span>
  );
}

export function ConfirmDialog({
  children,
  title,
  body,
  confirmLabel,
  onConfirm
}: {
  children: ReactElement<ButtonHTMLAttributes<HTMLButtonElement>>;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = cloneElement(children, {
    onClick: (event) => {
      children.props.onClick?.(event);
      setOpen(true);
    }
  });

  return (
    <Dialog.Root onOpenChange={setOpen} open={open}>
      {trigger}
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-neutral-200 bg-white p-5 shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
          <Dialog.Title className="text-base font-semibold text-neutral-950 dark:text-neutral-50">
            {title}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
            {body}
          </Dialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <Button tone="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              tone="danger"
              onClick={() => {
                onConfirm();
                setOpen(false);
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Toggle({
  checked,
  onCheckedChange,
  label
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <Switch.Root
      aria-label={label}
      checked={checked}
      className="flex h-6 w-11 items-center rounded-full bg-neutral-300 p-0.5 transition data-[checked]:bg-blue-600 dark:bg-neutral-700"
      onCheckedChange={onCheckedChange}
    >
      <Switch.Thumb className="h-5 w-5 rounded-full bg-white shadow transition data-[checked]:translate-x-5" />
    </Switch.Root>
  );
}
